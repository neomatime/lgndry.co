export type InboxFolder =
  "inbox" | "all" | "unread" | "starred" | "sent" | "drafts" | "archive" | "trash";

export type EmailAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
};

export type EmailMessage = {
  id: string;
  direction: "Incoming" | "Outgoing" | "Internal";
  status: string;
  fromName: string | null;
  fromEmail: string | null;
  toName: string | null;
  toEmail: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  bodyHtml: string | null;
  occurredAt: string;
  isRead: boolean;
  version: number;
  attachments: EmailAttachment[];
};

export type LinkedRecord = { id: string; label: string; href: string };

export type InboxThread = {
  id: string;
  subject: string;
  snippet: string;
  latestMessageAt: string;
  messageCount: number;
  isRead: boolean;
  isStarred: boolean;
  archivedAt: string | null;
  trashedAt: string | null;
  version: number;
  participantName: string;
  participantEmail: string;
  messages: EmailMessage[];
  client: (LinkedRecord & { status: string | null }) | null;
  contact:
    (LinkedRecord & { email: string; phone: string | null; roleTitle: string | null }) | null;
  enquiry: LinkedRecord | null;
  project: LinkedRecord | null;
  quote: LinkedRecord | null;
  invoice: LinkedRecord | null;
  followUp: LinkedRecord | null;
};

export type InboxOption = { id: string; label: string; parentId?: string | null };

export type InboxOptions = {
  clients: InboxOption[];
  contacts: InboxOption[];
  enquiries: InboxOption[];
  projects: InboxOption[];
  quotes: InboxOption[];
  invoices: InboxOption[];
  followUps: InboxOption[];
};

export type InboxData = {
  threads: InboxThread[];
  options: InboxOptions;
  lastSyncedAt: string | null;
};

export type InboxActionState =
  | {
      status: "success";
      threadId?: string;
      emailId?: string;
      version?: number;
      message?: string;
    }
  | { status: "invalid" | "conflict" | "not-found" | "error"; message: string };

export type InboxUploadState =
  | {
      status: "success";
      threadId: string;
      emailId: string;
      version: number;
      storagePath: string;
      signedUrl: string;
    }
  | { status: "invalid" | "conflict" | "not-found" | "error"; message: string };
