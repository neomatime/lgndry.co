import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.lgndry-co.co.za",
  "https://lgndry-co.co.za",
  "https://lgndry-co.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "null",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.lgndry-co.co.za",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match] || match));
}

function textToHtml(value: unknown) {
  return String(value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function recipients(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const authorization = request.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceKey || !authorization) return json(request, { error: "Unauthorized" }, 401);
    if (!resendKey) return json(request, { error: "Resend is not configured. Add RESEND_API_KEY to Supabase secrets." }, 500);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    const caller = callerData.user;
    if (callerError || !caller) return json(request, { error: "Unauthorized" }, 401);

    const { data: membership, error: membershipError } = await serviceClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (membershipError || !membership) return json(request, { error: "Admin access required" }, 403);

    const body = await request.json();
    const to = recipients(body.to);
    const cc = recipients(body.cc);
    const subject = String(body.subject || "").trim();
    const text = String(body.text || body.body || "").trim();
    const html = String(body.html || "").trim() || textToHtml(text);
    const emailId = String(body.emailId || "").trim();

    if (!to.length || !subject || !text) {
      return json(request, { error: "Recipient, subject and message are required." }, 400);
    }

    const resendPayload: Record<string, unknown> = {
      from: Deno.env.get("ADMIN_EMAIL_FROM") || Deno.env.get("RESEND_EMAIL_FROM") || "LGNDRY.Co <info@lgndry-co.co.za>",
      to,
      subject,
      text,
      html,
    };
    if (cc.length) resendPayload.cc = cc;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });
    const resendResult = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(request, { error: resendResult?.message || `Resend returned ${response.status}` }, 400);
    }

    if (emailId) {
      await serviceClient.from("emails").update({ status: "Sent" }).eq("id", emailId);
    }

    return json(request, { sent: true, id: resendResult?.id || null });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Unable to send email" }, 400);
  }
});
