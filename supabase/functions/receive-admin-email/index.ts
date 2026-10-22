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

function normalizeSubject(value: string) {
  return value.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim().toLowerCase();
}

function header(message: Record<string, unknown>, name: string) {
  const headers = (message.headers || {}) as Record<string, unknown>;
  return String(headers[name] || headers[name.toLowerCase()] || "").trim();
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
    const { data: account, error: accountError } = await serviceClient
      .from("email_accounts")
      .select("id")
      .eq("is_default", true)
      .single();
    if (accountError || !account) throw new Error("Default email account is not configured");
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
    const { data: contact } = fromEmail
      ? await serviceClient
        .from("client_contacts")
        .select("id, client_id")
        .ilike("email", fromEmail)
        .eq("archived", false)
        .limit(1)
        .maybeSingle()
      : { data: null };
    const body = String(message.text || "").trim() || plainText(message.html);
    const messageId = String(event.data.message_id || message.message_id || providerEmailId);
    const inReplyTo = header(message, "in-reply-to");
    const references = header(message, "references").split(/\s+/).filter(Boolean);
    const parentIds = Array.from(new Set([...references, inReplyTo].filter(Boolean)));
    const { data: parent } = parentIds.length
      ? await serviceClient.from("emails").select("thread_id").in("message_id_header", parentIds).limit(1).maybeSingle()
      : { data: null };
    let threadId = parent?.thread_id || null;
    if (!threadId) {
      const { data: createdThread, error: threadError } = await serviceClient
        .from("email_threads")
        .insert({
          account_id: account.id,
          subject: String(event.data.subject || message.subject || "(No subject)"),
          normalized_subject: normalizeSubject(String(event.data.subject || message.subject || "")),
          participant_emails: [fromEmail, String(to[0] || "")].filter(Boolean),
          participant_names: [displayName(fromHeader, fromEmail)],
          snippet: body.replace(/\s+/g, " ").slice(0, 240),
          latest_message_at: receivedAt,
          message_count: 0,
          is_read: false,
          client_id: contact?.client_id || null,
          contact_id: contact?.id || null,
        })
        .select("id")
        .single();
      if (threadError) throw threadError;
      threadId = createdThread.id;
    }

    const { data: inserted, error: insertError } = await serviceClient.from("emails").insert({
      account_id: account.id,
      thread_id: threadId,
      subject: String(event.data.subject || message.subject || "(No subject)"),
      direction: "Incoming",
      status: "Inbox",
      priority: "Normal",
      client: contact?.client_id || null,
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
      provider_message_id: messageId,
      message_id_header: messageId,
      in_reply_to_header: inReplyTo || null,
      references_header: references,
      body_html: String(message.html || "") || null,
      is_read: false,
    }).select("id").single();
    if (insertError && insertError.code !== "23505") throw insertError;

    if (inserted && Array.isArray(message.attachments)) {
      for (const item of message.attachments) {
        const attachment = item as Record<string, unknown>;
        const providerAttachmentId = String(attachment.id || attachment.attachment_id || "");
        if (!providerAttachmentId) continue;
        await serviceClient.from("email_attachments").insert({
          email_id: inserted.id,
          file_name: String(attachment.filename || attachment.name || "attachment"),
          content_type: String(attachment.content_type || "application/octet-stream"),
          size_bytes: Number(attachment.size || 0),
          provider_attachment_id: providerAttachmentId,
        });
      }
    }

    const { count } = await serviceClient.from("emails")
      .select("id", { count: "exact", head: true }).eq("thread_id", threadId);
    await serviceClient.from("email_threads").update({
      snippet: body.replace(/\s+/g, " ").slice(0, 240),
      latest_message_at: receivedAt,
      message_count: count || 1,
      is_read: false,
      archived_at: null,
      trashed_at: null,
    }).eq("id", threadId);

    return json({ received: true });
  } catch (error) {
    console.error("Unable to ingest inbound email", error);
    return json({ error: error instanceof Error ? error.message : "Unable to ingest inbound email" }, 500);
  }
});
