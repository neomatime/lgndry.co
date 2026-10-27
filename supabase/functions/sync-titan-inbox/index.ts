import { Buffer } from "node:buffer";
import { simpleParser } from "npm:mailparser@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IMAP_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: number | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), IMAP_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function imapQuote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function imapDate(value: Date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${value.getUTCDate()}-${months[value.getUTCMonth()]}-${value.getUTCFullYear()}`;
}

class TitanImapClient {
  private connection: Deno.TlsConn | null = null;
  private buffer = new Uint8Array();
  private sequence = 0;

  async connect(hostname: string, port: number) {
    this.connection = await withTimeout(
      Deno.connectTls({ hostname, port }),
      "Titan IMAP connection timed out",
    );
    const greeting = await this.readLine();
    if (!/^\*\s+(?:OK|PREAUTH)\b/i.test(greeting)) {
      throw new Error(`Titan IMAP rejected the connection: ${greeting.slice(0, 160)}`);
    }
  }

  async login(user: string, password: string) {
    await this.command(`LOGIN ${imapQuote(user)} ${imapQuote(password)}`);
  }

  async examineInbox() {
    const response = await this.command('EXAMINE "INBOX"');
    const match = response.lines.join("\n").match(/\[UIDNEXT\s+(\d+)\]/i);
    return match ? Number(match[1]) : 0;
  }

  async search(criteria: string) {
    const response = await this.command(`UID SEARCH ${criteria}`);
    return response.lines
      .filter((line) => /^\*\s+SEARCH\b/i.test(line))
      .flatMap((line) =>
        line
          .replace(/^\*\s+SEARCH\s*/i, "")
          .trim()
          .split(/\s+/),
      )
      .map(Number)
      .filter((uid) => Number.isSafeInteger(uid) && uid > 0);
  }

  async fetchSource(uid: number) {
    const response = await this.command(`UID FETCH ${uid} (UID BODY.PEEK[])`);
    return response.literals[0] ?? null;
  }

  async logout() {
    if (!this.connection) return;
    try {
      await this.command("LOGOUT");
    } finally {
      this.close();
    }
  }

  close() {
    try {
      this.connection?.close();
    } catch {
      // The remote server may already have closed the socket.
    }
    this.connection = null;
  }

  private async command(command: string) {
    if (!this.connection) throw new Error("Titan IMAP is not connected");
    const tag = `A${String(++this.sequence).padStart(4, "0")}`;
    await withTimeout(
      this.connection.write(encoder.encode(`${tag} ${command}\r\n`)),
      "Titan IMAP write timed out",
    );

    const lines: string[] = [];
    const literals: Uint8Array[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      const literalMatch = line.match(/\{(\d+)\}$/);
      if (literalMatch) literals.push(await this.readBytes(Number(literalMatch[1])));
      if (!line.startsWith(`${tag} `)) continue;
      if (!line.startsWith(`${tag} OK`)) {
        throw new Error(`Titan IMAP command failed: ${line.slice(tag.length + 1, 240)}`);
      }
      return { lines, literals };
    }
  }

  private async readLine() {
    while (true) {
      const end = this.buffer.findIndex(
        (value, index) => value === 13 && this.buffer[index + 1] === 10,
      );
      if (end >= 0) {
        const line = decoder.decode(this.buffer.slice(0, end));
        this.buffer = this.buffer.slice(end + 2);
        return line;
      }
      await this.readMore();
    }
  }

  private async readBytes(length: number) {
    while (this.buffer.length < length) await this.readMore();
    const value = this.buffer.slice(0, length);
    this.buffer = this.buffer.slice(length);
    return value;
  }

  private async readMore() {
    if (!this.connection) throw new Error("Titan IMAP is not connected");
    const chunk = new Uint8Array(16_384);
    const length = await withTimeout(this.connection.read(chunk), "Titan IMAP response timed out");
    if (length === null) throw new Error("Titan IMAP closed the connection unexpectedly");
    const merged = new Uint8Array(this.buffer.length + length);
    merged.set(this.buffer);
    merged.set(chunk.subarray(0, length), this.buffer.length);
    this.buffer = merged;
  }
}

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
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://www.lgndry-co.co.za",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-sync-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
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

function normalizeSubject(value: string) {
  return value
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

function headerIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean);
}

async function authorizeCaller(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  syncSecret: string,
) {
  const providedSecret = request.headers.get("x-sync-secret");
  if (syncSecret && providedSecret === syncSecret) return true;

  const authorization = request.headers.get("Authorization");
  if (!authorization) return false;
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (token === serviceKey) return true;

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
    return json(
      request,
      { error: "IMAP is not configured. Add IMAP_USER and IMAP_PASSWORD to Supabase secrets." },
      500,
    );
  }

  const authorized = await authorizeCaller(request, supabaseUrl, anonKey, serviceKey, syncSecret);
  if (!authorized) return json(request, { error: "Unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let client: TitanImapClient | null = null;
  try {
    const { data: account, error: accountError } = await serviceClient
      .from("email_accounts")
      .select("id")
      .eq("is_default", true)
      .single();
    if (accountError || !account) {
      throw new Error("Default email account is not configured");
    }

    const { data: state, error: stateError } = await serviceClient
      .from("email_sync_state")
      .select("id, last_uid")
      .eq("mailbox", imapUser)
      .maybeSingle();
    if (stateError) throw stateError;

    const stateId = state?.id;
    const lastUid = Number(state?.last_uid || 0);

    const candidateHosts = Array.from(new Set([imapHost, "imap0101.titan.email"]));
    let connectionError: unknown = null;
    for (const hostname of candidateHosts) {
      const candidate = new TitanImapClient();
      try {
        await candidate.connect(hostname, imapPort);
        await candidate.login(imapUser, imapPassword);
        client = candidate;
        break;
      } catch (error) {
        candidate.close();
        connectionError = error;
      }
    }
    if (!client) throw connectionError ?? new Error("Titan IMAP connection failed");
    const uidNext = await client.examineInbox();
    let synced = 0;
    let highestUid = lastUid;

    let uids: number[] = [];
    if (lastUid > 0) {
      if (uidNext && lastUid + 1 >= uidNext) {
        uids = [];
      } else {
        uids = await client.search(`UID ${lastUid + 1}:*`);
      }
    } else {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      uids = await client.search(`SINCE ${imapDate(since)}`);
    }

    // Recover recent messages if Titan resets mailbox UIDs or an earlier run stopped mid-batch.
    if (!uids.length) {
      const recent = new Date();
      recent.setDate(recent.getDate() - 2);
      uids = await client.search(`SINCE ${imapDate(recent)}`);
    }

    uids = Array.from(new Set(uids)).sort((a, b) => a - b);

    for (const uid of uids) {
      const source = await client.fetchSource(uid);
      if (!source) continue;
      const parsed = await simpleParser(Buffer.from(source));

      const fromEmail = parsed.from?.value?.[0]?.address || "";
      const fromHeader = parsed.from?.text || "";
      const toEmail = parsed.to && "value" in parsed.to ? parsed.to.value?.[0]?.address || "" : "";
      const messageId = parsed.messageId || `titan-${imapUser}-${uid}`;
      const inReplyTo = String(parsed.inReplyTo || "").trim();
      const references = headerIds(parsed.references);
      const receivedAt = (parsed.date || new Date()).toISOString();

      const { data: existing } = await serviceClient
        .from("emails")
        .select("id")
        .eq("provider_email_id", messageId)
        .maybeSingle();

      if (!existing) {
        const { data: matchedContact } = fromEmail
          ? await serviceClient
              .from("client_contacts")
              .select("id, client_id")
              .ilike("email", fromEmail)
              .eq("archived", false)
              .limit(1)
              .maybeSingle()
          : { data: null };
        const parentIds = Array.from(new Set([...references, inReplyTo].filter(Boolean)));
        const { data: parent } = parentIds.length
          ? await serviceClient
              .from("emails")
              .select("thread_id")
              .in("message_id_header", parentIds)
              .limit(1)
              .maybeSingle()
          : { data: null };
        let threadId = parent?.thread_id || null;
        if (!threadId) {
          const { data: createdThread, error: threadError } = await serviceClient
            .from("email_threads")
            .insert({
              account_id: account.id,
              subject: parsed.subject || "(No subject)",
              normalized_subject: normalizeSubject(parsed.subject || ""),
              participant_emails: [fromEmail, toEmail || imapUser].filter(Boolean),
              participant_names: [displayName(fromHeader, fromEmail)],
              snippet: String(parsed.text || "")
                .replace(/\s+/g, " ")
                .slice(0, 240),
              latest_message_at: receivedAt,
              message_count: 0,
              is_read: false,
              client_id: matchedContact?.client_id || null,
              contact_id: matchedContact?.id || null,
            })
            .select("id")
            .single();
          if (threadError) throw threadError;
          threadId = createdThread.id;
        }

        const { data: inserted, error: insertError } = await serviceClient
          .from("emails")
          .insert({
            account_id: account.id,
            thread_id: threadId,
            subject: parsed.subject || "(No subject)",
            direction: "Incoming",
            status: "Inbox",
            priority: "Normal",
            client: matchedContact?.client_id || null,
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
            message_id_header: messageId,
            in_reply_to_header: inReplyTo || null,
            references_header: references,
            body_html: typeof parsed.html === "string" ? parsed.html : null,
            is_read: false,
          })
          .select("id")
          .single();
        if (insertError && insertError.code !== "23505") throw insertError;

        if (inserted && parsed.attachments?.length) {
          for (const item of parsed.attachments) {
            const fileName = item.filename || "attachment";
            const path = `${threadId}/${inserted.id}/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const { error: uploadError } = await serviceClient.storage
              .from("email-attachments")
              .upload(path, item.content, {
                contentType: item.contentType || "application/octet-stream",
              });
            if (uploadError) throw uploadError;
            const { error: attachmentError } = await serviceClient
              .from("email_attachments")
              .insert({
                email_id: inserted.id,
                file_name: fileName,
                content_type: item.contentType || "application/octet-stream",
                size_bytes: item.size || item.content?.length || 0,
                storage_path: path,
              });
            if (attachmentError) throw attachmentError;
          }
        }

        const { count } = await serviceClient
          .from("emails")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", threadId);
        await serviceClient
          .from("email_threads")
          .update({
            subject: parsed.subject || "(No subject)",
            snippet: String(parsed.text || "")
              .replace(/\s+/g, " ")
              .slice(0, 240),
            latest_message_at: receivedAt,
            message_count: count || 1,
            is_read: false,
            archived_at: null,
            trashed_at: null,
          })
          .eq("id", threadId);
        synced += 1;
      }

      if (uid > highestUid) highestUid = uid;
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
        await serviceClient.from("email_sync_state").insert({
          mailbox: imapUser,
          last_uid: highestUid,
          last_synced_at: new Date().toISOString(),
        });
      }
    } else {
      await serviceClient
        .from("email_sync_state")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("mailbox", imapUser);
    }

    await serviceClient
      .from("email_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", account.id);

    return json(request, { synced, lastUid: highestUid });
  } catch (error) {
    if (client) {
      try {
        client.close();
      } catch (_) {
        // ignore
      }
    }
    console.error("sync-titan-inbox error:", error);
    return json(
      request,
      { error: error instanceof Error ? error.message : "Unable to sync inbox" },
      500,
    );
  }
});
