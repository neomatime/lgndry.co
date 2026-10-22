import "server-only";

import type {
  EmailAttachment,
  EmailMessage,
  InboxData,
  InboxOption,
  InboxOptions,
  InboxThread,
  LinkedRecord,
} from "@/features/inbox/types";
import { createSupabaseServerClient } from "@/lib/db/server";

type Row = Record<string, unknown>;

const THREAD_SELECT = `
  id, subject, snippet, latest_message_at, message_count, is_read, is_starred,
  archived_at, trashed_at, version, participant_emails, participant_names,
  client_record:clients!email_threads_client_id_fkey(id, name, status),
  contact_record:client_contacts!email_threads_contact_id_fkey(
    id, full_name, email, phone, role_title
  ),
  enquiry_record:enquiries!email_threads_enquiry_id_fkey(id, project_type, full_name),
  project_record:projects!email_threads_project_id_fkey(id, name),
  quote_record:commercial_quotes!email_threads_quote_id_fkey(id, reference_number),
  invoice_record:commercial_invoices!email_threads_invoice_id_fkey(id, reference_number),
  follow_up_record:follow_ups!email_threads_follow_up_id_fkey(id, reference_number, title),
  messages:emails!emails_thread_id_fkey(
    id, direction, status, fromName, fromEmail, toName, toEmail, cc, bcc, subject, body,
    body_html, received_at, sent_at, created_at, is_read, version,
    email_attachments(id, file_name, content_type, size_bytes, storage_path)
  )
`;

function one(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return value && typeof value === "object" ? (value as Row) : null;
}

function text(value: unknown) {
  return value == null ? null : String(value);
}

function record(value: unknown, href: string, labelKey = "name"): LinkedRecord | null {
  const row = one(value);
  if (!row) return null;
  return { id: String(row.id), label: String(row[labelKey] ?? "Record"), href };
}

function reference(prefix: string, value: unknown) {
  return `${prefix}-${String(value ?? 0).padStart(4, "0")}`;
}

async function attachment(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: Row,
): Promise<EmailAttachment> {
  const path = text(value.storage_path);
  let url: string | null = null;
  if (path) {
    const result = await supabase.storage.from("email-attachments").createSignedUrl(path, 900);
    url = result.data?.signedUrl ?? null;
  }
  return {
    id: String(value.id),
    fileName: String(value.file_name),
    contentType: String(value.content_type),
    sizeBytes: Number(value.size_bytes),
    url,
  };
}

async function message(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: Row,
): Promise<EmailMessage> {
  const attachmentRows = Array.isArray(value.email_attachments)
    ? (value.email_attachments as Row[])
    : [];
  return {
    id: String(value.id),
    direction: String(value.direction) as EmailMessage["direction"],
    status: String(value.status),
    fromName: text(value.fromName),
    fromEmail: text(value.fromEmail),
    toName: text(value.toName),
    toEmail: String(value.toEmail),
    cc: String(value.cc ?? ""),
    bcc: String(value.bcc ?? ""),
    subject: String(value.subject),
    body: String(value.body ?? ""),
    bodyHtml: text(value.body_html),
    occurredAt: String(value.received_at ?? value.sent_at ?? value.created_at),
    isRead: Boolean(value.is_read),
    version: Number(value.version),
    attachments: await Promise.all(attachmentRows.map((row) => attachment(supabase, row))),
  };
}

async function shapeThread(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: Row,
): Promise<InboxThread> {
  const clientRow = one(value.client_record);
  const contactRow = one(value.contact_record);
  const enquiryRow = one(value.enquiry_record);
  const quoteRow = one(value.quote_record);
  const invoiceRow = one(value.invoice_record);
  const followUpRow = one(value.follow_up_record);
  const messages = await Promise.all(
    (Array.isArray(value.messages) ? (value.messages as Row[]) : []).map((row) =>
      message(supabase, row),
    ),
  );
  messages.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const latest = messages.at(-1);
  const participantNames = Array.isArray(value.participant_names)
    ? value.participant_names.map(String)
    : [];
  const participantEmails = Array.isArray(value.participant_emails)
    ? value.participant_emails.map(String)
    : [];
  return {
    id: String(value.id),
    subject: String(value.subject),
    snippet: String(value.snippet ?? ""),
    latestMessageAt: String(value.latest_message_at),
    messageCount: Number(value.message_count),
    isRead: Boolean(value.is_read),
    isStarred: Boolean(value.is_starred),
    archivedAt: text(value.archived_at),
    trashedAt: text(value.trashed_at),
    version: Number(value.version),
    participantName:
      contactRow?.full_name?.toString() ??
      clientRow?.name?.toString() ??
      participantNames[0] ??
      latest?.fromName ??
      latest?.fromEmail ??
      "Unknown sender",
    participantEmail:
      contactRow?.email?.toString() ?? participantEmails[0] ?? latest?.fromEmail ?? "",
    messages,
    client: clientRow
      ? {
          id: String(clientRow.id),
          label: String(clientRow.name),
          href: `/ops/clients/${clientRow.id}`,
          status: text(clientRow.status),
        }
      : null,
    contact: contactRow
      ? {
          id: String(contactRow.id),
          label: String(contactRow.full_name),
          href: clientRow ? `/ops/clients/${clientRow.id}` : "#",
          email: String(contactRow.email),
          phone: text(contactRow.phone),
          roleTitle: text(contactRow.role_title),
        }
      : null,
    enquiry: enquiryRow
      ? {
          id: String(enquiryRow.id),
          label: `${String(enquiryRow.project_type)} enquiry`,
          href: `/ops/enquiries/${enquiryRow.id}`,
        }
      : null,
    project: record(value.project_record, `/ops/projects/${one(value.project_record)?.id ?? ""}`),
    quote: quoteRow
      ? {
          id: String(quoteRow.id),
          label: reference("QT", quoteRow.reference_number),
          href: `/ops/invoices/quotes/${quoteRow.id}`,
        }
      : null,
    invoice: invoiceRow
      ? {
          id: String(invoiceRow.id),
          label: reference("INV", invoiceRow.reference_number),
          href: `/ops/invoices/${invoiceRow.id}`,
        }
      : null,
    followUp: followUpRow
      ? {
          id: String(followUpRow.id),
          label: String(followUpRow.title ?? reference("FUP", followUpRow.reference_number)),
          href: `/ops/follow-ups/${followUpRow.id}`,
        }
      : null,
  };
}

function options(rows: unknown[] | null, label: (row: Row) => string, parentKey?: string) {
  return (rows ?? []).map((value) => {
    const row = value as Row;
    return {
      id: String(row.id),
      label: label(row),
      parentId: parentKey ? text(row[parentKey]) : undefined,
    } satisfies InboxOption;
  });
}

export async function fetchInbox(): Promise<InboxData | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [
      threadsResult,
      syncResult,
      clientsResult,
      contactsResult,
      enquiriesResult,
      projectsResult,
      quotesResult,
      invoicesResult,
      followUpsResult,
    ] = await Promise.all([
      supabase
        .from("email_threads")
        .select(THREAD_SELECT)
        .order("latest_message_at", { ascending: false }),
      supabase.from("email_accounts").select("last_synced_at").eq("is_default", true).maybeSingle(),
      supabase.from("clients").select("id, name").eq("archived", false).order("name"),
      supabase
        .from("client_contacts")
        .select("id, client_id, full_name, email")
        .eq("archived", false)
        .order("full_name"),
      supabase
        .from("enquiries")
        .select("id, client_id, project_type, full_name")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, client_id, name").eq("archived", false).order("name"),
      supabase
        .from("commercial_quotes")
        .select("id, client_id, reference_number")
        .order("created_at", { ascending: false }),
      supabase
        .from("commercial_invoices")
        .select("id, client_id, reference_number")
        .order("created_at", { ascending: false }),
      supabase
        .from("follow_ups")
        .select("id, client_id, reference_number, title")
        .order("created_at", { ascending: false }),
    ]);
    const results = [
      threadsResult,
      syncResult,
      clientsResult,
      contactsResult,
      enquiriesResult,
      projectsResult,
      quotesResult,
      invoicesResult,
      followUpsResult,
    ];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const inboxOptions: InboxOptions = {
      clients: options(clientsResult.data, (row) => String(row.name)),
      contacts: options(
        contactsResult.data,
        (row) => `${row.full_name} · ${row.email}`,
        "client_id",
      ),
      enquiries: options(
        enquiriesResult.data,
        (row) => `${row.project_type} · ${row.full_name}`,
        "client_id",
      ),
      projects: options(projectsResult.data, (row) => String(row.name), "client_id"),
      quotes: options(
        quotesResult.data,
        (row) => reference("QT", row.reference_number),
        "client_id",
      ),
      invoices: options(
        invoicesResult.data,
        (row) => reference("INV", row.reference_number),
        "client_id",
      ),
      followUps: options(
        followUpsResult.data,
        (row) => String(row.title ?? reference("FUP", row.reference_number)),
        "client_id",
      ),
    };
    return {
      threads: await Promise.all(
        ((threadsResult.data ?? []) as unknown as Row[]).map((row) => shapeThread(supabase, row)),
      ),
      options: inboxOptions,
      lastSyncedAt: syncResult.data?.last_synced_at ?? null,
    };
  } catch (error) {
    console.error("Could not load Inbox", error);
    return null;
  }
}
