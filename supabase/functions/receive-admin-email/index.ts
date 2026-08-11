import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function verifiesResendWebhook(request: Request, rawPayload: string, secret: string) {
  const messageId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatureHeader = request.headers.get("svix-signature");
  if (!messageId || !timestamp || !signatureHeader) return false;

  const eventTime = Number(timestamp);
  if (!Number.isFinite(eventTime) || Math.abs(Date.now() / 1000 - eventTime) > 5 * 60) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    bytesFromBase64(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${messageId}.${timestamp}.${rawPayload}`));
  const expected = new Uint8Array(signed);

  return signatureHeader.split(" ").some((signature) => {
    const [version, value] = signature.split(",", 2);
    if (version !== "v1" || !value) return false;
    try {
      return constantTimeEqual(expected, bytesFromBase64(value));
    } catch (_) {
      return false;
    }
  });
}

function displayName(value: string, fallback: string) {
  const match = value.match(/^\s*(.*?)\s*<[^>]+>\s*$/);
  const name = match ? match[1].replace(/^"|"$/g, "").trim() : "";
  return name || fallback.split("@")[0] || "Client";
}

function plainText(value: unknown) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(\r?\n)?/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

Deno.serve(async (request) => {
  if (request.method === "GET") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!webhookSecret || !resendKey || !supabaseUrl || !serviceKey) {
      return json({ error: "Inbound email is not configured" }, 500);
    }

    const rawPayload = await request.text();
    if (!(await verifiesResendWebhook(request, rawPayload, webhookSecret))) {
      return json({ error: "Invalid webhook signature" }, 401);
    }

    const event = JSON.parse(rawPayload);
    if (event?.type !== "email.received" || !event?.data?.email_id) return json({ received: true });

    const providerEmailId = String(event.data.email_id);
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: existing, error: existingError } = await serviceClient
      .from("emails")
      .select("id")
      .eq("provider_email_id", providerEmailId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ received: true, duplicate: true });

    const contentResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(providerEmailId)}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    const contentResult = await contentResponse.json().catch(() => ({}));
    if (!contentResponse.ok) throw new Error(contentResult?.message || "Unable to retrieve inbound email content");
    const message = contentResult?.data || contentResult;

    const fromEmail = String(event.data.from || message.from || "").trim();
    const fromHeader = String(message?.headers?.from || "");
    const to = Array.isArray(event.data.to) ? event.data.to : [];
    const receivedAt = String(event.data.created_at || message.created_at || new Date().toISOString());
    const { data: client } = fromEmail
      ? await serviceClient.from("clients").select("id").ilike("email", fromEmail).limit(1).maybeSingle()
      : { data: null };
    const body = String(message.text || "").trim() || plainText(message.html);

    const { error: insertError } = await serviceClient.from("emails").insert({
      subject: String(event.data.subject || message.subject || "(No subject)"),
      direction: "Incoming",
      status: "Inbox",
      priority: "Normal",
      client: client?.id || null,
      fromName: displayName(fromHeader, fromEmail),
      fromEmail: fromEmail || null,
      toName: "LGNDRY.Co",
      toEmail: String(to[0] || "").trim() || "neomokgwadi@lgndry-co.co.za",
      cc: Array.isArray(event.data.cc) ? event.data.cc.join(", ") : "",
      category: "General",
      receivedAt: receivedAt.slice(0, 10),
      received_at: receivedAt,
      owner: "Dan Mokgwadi",
      body,
      archived: false,
      provider: "Resend",
      provider_email_id: providerEmailId,
      provider_message_id: String(event.data.message_id || message.message_id || "") || null,
    });
    if (insertError && insertError.code !== "23505") throw insertError;

    return json({ received: true });
  } catch (error) {
    console.error("Unable to ingest inbound email", error);
    return json({ error: error instanceof Error ? error.message : "Unable to ingest inbound email" }, 500);
  }
});
