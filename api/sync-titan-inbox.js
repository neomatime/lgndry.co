// Vercel serverless function — pulls recent INBOX mail from the Titan/GoDaddy
// mailbox (neomokgwadi@lgndry-co.co.za) into the `emails` table as inbound
// rows, for the Command Center's Communications Inbox.
//
// This replaces an earlier attempt at the same job as a Supabase Edge
// Function (Deno): imapflow's raw TCP/TLS socket connect() hung indefinitely
// under Deno's npm-compat layer on that runtime, so the function never
// completed. Node's native net/tls support (this runtime) doesn't have that
// problem — same pattern already proven working for Oak & Pixel's own OPS
// Communications Hub (api/sync-inbox.js there).
//
// Triggered two ways:
//   1. The "Sync Inbox" button in the admin Communications email portal
//      (Authorization: Bearer <supabase user JWT>)
//   2. The Vercel cron defined in vercel.json (Authorization: Bearer <CRON_SECRET>,
//      injected automatically by Vercel)
//
// Required env vars (Vercel Project Settings -> Environment Variables):
//   IMAP_USER, IMAP_PASSWORD            — the mailbox (neomokgwadi@lgndry-co.co.za)
//   IMAP_HOST (default imap.titan.email), IMAP_PORT (default 993)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET                         — required for the cron trigger

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const FETCH_RECENT = 40; // how many of the newest INBOX messages to scan per run

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const IMAP_USER = process.env.IMAP_USER;
  const IMAP_PASS = process.env.IMAP_PASSWORD;
  const IMAP_HOST = process.env.IMAP_HOST || 'imap.titan.email';
  const IMAP_PORT = Number(process.env.IMAP_PORT || 993);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(503).json({ error: 'Server misconfigured (Supabase env vars missing)' }); return;
  }
  if (!IMAP_USER || !IMAP_PASS) {
    res.status(503).json({ error: 'Inbox not configured — add IMAP_USER and IMAP_PASSWORD in Vercel' }); return;
  }

  const authorized = await verifyCaller(req, SUPABASE_URL, SERVICE_KEY);
  if (!authorized) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const sbHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };

  let parsed = [];
  const client = new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS }, logger: false,
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = client.mailbox && client.mailbox.exists ? client.mailbox.exists : 0;
      if (total > 0) {
        const start = Math.max(1, total - (FETCH_RECENT - 1));
        for await (const msg of client.fetch(`${start}:*`, { source: true })) {
          try {
            const mail = await simpleParser(msg.source);
            const fromAddr = mail.from && mail.from.value && mail.from.value[0];
            const toAddr = mail.to && mail.to.value && mail.to.value[0];
            parsed.push({
              messageId: mail.messageId || `titan-${IMAP_USER}-${msg.uid}`,
              from: fromAddr ? fromAddr.address : '',
              fromName: fromAddr ? fromAddr.name : '',
              to: toAddr ? toAddr.address : IMAP_USER,
              subject: mail.subject || '(No subject)',
              body: (mail.text || '').trim() || stripHtml(mail.html) || '',
              date: mail.date ? mail.date.toISOString() : new Date().toISOString(),
            });
          } catch (e) { /* skip unparseable message */ }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    try { await client.close(); } catch (_) { /* ignore */ }
    const message = /auth/i.test((err && err.message) || '')
      ? 'IMAP login failed — check the mailbox password.'
      : 'Could not reach the mail server.';
    res.status(502).json({ error: message }); return;
  }

  if (!parsed.length) { res.status(200).json({ ok: true, synced: 0 }); return; }

  const existingIds = new Set();
  try {
    const ids = parsed.map((p) => `"${p.messageId.replace(/"/g, '\\"')}"`).join(',');
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/emails?provider_email_id=in.(${ids})&select=provider_email_id`,
      { headers: sbHeaders }
    );
    if (r.ok) (await r.json()).forEach((row) => existingIds.add(row.provider_email_id));
  } catch (_) { /* dedup read failed — proceed, accepting some dup risk */ }

  const fresh = parsed.filter((p) => !existingIds.has(p.messageId));
  if (!fresh.length) { res.status(200).json({ ok: true, synced: 0 }); return; }

  const emailToClient = await mapClients(fresh.map((p) => p.from), SUPABASE_URL, sbHeaders);
  const rows = fresh.map((p) => ({
    subject: p.subject,
    direction: 'Incoming',
    status: 'Inbox',
    priority: 'Normal',
    client: emailToClient[p.from.toLowerCase()] || null,
    fromName: p.fromName || (p.from ? p.from.split('@')[0] : 'Client'),
    fromEmail: p.from || null,
    toName: 'LGNDRY.Co',
    toEmail: p.to || IMAP_USER,
    category: 'General',
    receivedAt: p.date.slice(0, 10),
    received_at: p.date,
    owner: 'Dan Mokgwadi',
    body: p.body,
    archived: false,
    provider: 'Titan IMAP',
    provider_email_id: p.messageId,
    provider_message_id: p.messageId,
  }));

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/emails`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      res.status(502).json({ error: e.message || 'Could not save inbound mail' }); return;
    }
  } catch (_) {
    res.status(502).json({ error: 'Could not save inbound mail' }); return;
  }

  res.status(200).json({ ok: true, synced: rows.length });
};

async function verifyCaller(req, supabaseUrl, serviceKey) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
    });
    if (!r.ok) return false;
    const user = await r.json();
    const check = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${user.id}&select=user_id`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    if (!check.ok) return false;
    const rows = await check.json();
    return rows.length > 0;
  } catch (_) {
    return false;
  }
}

async function mapClients(emails, supabaseUrl, sbHeaders) {
  const map = {};
  const unique = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  await Promise.all(unique.map(async (email) => {
    try {
      const enc = encodeURIComponent(email);
      const r = await fetch(
        `${supabaseUrl}/rest/v1/clients?email=ilike.${enc}&select=id&limit=1`,
        { headers: sbHeaders }
      );
      if (r.ok) { const rows = await r.json(); if (rows[0]) map[email] = rows[0].id; }
    } catch (_) { /* leave unmapped */ }
  }));
  return map;
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
