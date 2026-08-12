import { ImapFlow } from "npm:imapflow@1";
import { simpleParser } from "npm:mailparser@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.lgndry-co.co.za",
  "https://lgndry-co.co.za",
  "https://lgndry-co.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8794",
  "http://127.0.0.1:8794",
  "null",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.lgndry-co.co.za",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function displayName(value: string, fallback: string) {
  const match = value.match(/^\s*(.*?)\s*<[^>]+>\s*$/);
  const name = match ? match[1].replace(/^"|"$/g, "").trim() : "";
  return name || fallback.split("@")[0] || "Client";
}

async function authorizeCaller(request: Request, supabaseUrl: string, anonKey: string, serviceKey: string, syncSecret: string) {
  const providedSecret = request.headers.get("x-sync-secret");
  if (syncSecret && providedSecret === syncSecret) return true;

  const authorization = request.headers.get("Authorization");
  if (!authorization) return false;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  const caller = callerData.user;
  if (callerError || !caller) return false;

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership } = await serviceClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  return !!membership;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST" && request.method !== "GET") {
    return json(request, { error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const syncSecret = Deno.env.get("SYNC_INBOX_SECRET") || "";
  const imapHost = Deno.env.get("IMAP_HOST") || "imap.titan.email";
  const imapPort = Number(Deno.env.get("IMAP_PORT") || "993");
  const imapUser = Deno.env.get("IMAP_USER");
  const imapPassword = Deno.env.get("IMAP_PASSWORD");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(request, { error: "Supabase environment is not configured" }, 500);
  }
  if (!imapUser || !imapPassword) {
    return json(request, { error: "IMAP is not configured. Add IMAP_USER and IMAP_PASSWORD to Supabase secrets." }, 500);
  }

  const authorized = await authorizeCaller(request, supabaseUrl, anonKey, serviceKey, syncSecret);
  if (!authorized) return json(request, { error: "Unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let client: ImapFlow | null = null;
  try {
    const { data: state, error: stateError } = await serviceClient
      .from("email_sync_state")
      .select("id, last_uid")
      .eq("mailbox", imapUser)
      .maybeSingle();
    if (stateError) throw stateError;

    const stateId = state?.id;
    const lastUid = Number(state?.last_uid || 0);

    client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPassword },
      logger: false,
    });
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    let synced = 0;
    let highestUid = lastUid;

    try {
      const uidNext = client.mailbox && "uidNext" in client.mailbox ? Number(client.mailbox.uidNext) : 0;

      let uids: number[] = [];
      if (lastUid > 0) {
        if (uidNext && lastUid + 1 >= uidNext) {
          uids = [];
        } else {
          uids = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        }
      } else {
        const since = new Date();
        since.setDate(since.getDate() - 14);
        uids = await client.search({ since }, { uid: true });
      }

      for await (const message of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);

        const fromEmail = parsed.from?.value?.[0]?.address || "";
        const fromHeader = parsed.from?.text || "";
        const toEmail = parsed.to && "value" in parsed.to ? parsed.to.value?.[0]?.address || "" : "";
        const messageId = parsed.messageId || `titan-${imapUser}-${message.uid}`;
        const receivedAt = (parsed.date || new Date()).toISOString();

        const { data: existing } = await serviceClient
          .from("emails")
          .select("id")
          .eq("provider_email_id", messageId)
          .maybeSingle();

        if (!existing) {
          const { data: matchedClient } = fromEmail
            ? await serviceClient.from("clients").select("id").ilike("email", fromEmail).limit(1).maybeSingle()
            : { data: null };

          const { error: insertError } = await serviceClient.from("emails").insert({
            subject: parsed.subject || "(No subject)",
            direction: "Incoming",
            status: "Inbox",
            priority: "Normal",
            client: matchedClient?.id || null,
            fromName: displayName(fromHeader, fromEmail),
            fromEmail: fromEmail || null,
            toName: "LGNDRY.Co",
            toEmail: toEmail || imapUser,
            cc: parsed.cc && "text" in parsed.cc ? parsed.cc.text || "" : "",
            category: "General",
            receivedAt: receivedAt.slice(0, 10),
            received_at: receivedAt,
            owner: "Dan Mokgwadi",
            body: parsed.text || "",
            archived: false,
            provider: "Titan IMAP",
            provider_email_id: messageId,
            provider_message_id: messageId,
          });
          if (insertError && insertError.code !== "23505") throw insertError;
          synced += 1;
        }

        if (message.uid > highestUid) highestUid = message.uid;
      }
    } finally {
      lock.release();
    }

    await client.logout();
    client = null;

    if (highestUid !== lastUid) {
      if (stateId) {
        await serviceClient
          .from("email_sync_state")
          .update({ last_uid: highestUid, last_synced_at: new Date().toISOString() })
          .eq("id", stateId);
      } else {
        await serviceClient
          .from("email_sync_state")
          .insert({ mailbox: imapUser, last_uid: highestUid, last_synced_at: new Date().toISOString() });
      }
    } else {
      await serviceClient
        .from("email_sync_state")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("mailbox", imapUser);
    }

    return json(request, { synced, lastUid: highestUid });
  } catch (error) {
    if (client) {
      try {
        await client.logout();
      } catch (_) {
        // ignore
      }
    }
    console.error("sync-titan-inbox error:", error);
    return json(request, { error: error instanceof Error ? error.message : "Unable to sync inbox" }, 500);
  }
});
