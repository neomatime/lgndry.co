"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  FileText,
  Inbox,
  Mail,
  MailOpen,
  Menu,
  MoreHorizontal,
  Paperclip,
  Pencil,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  deleteEmailDraft,
  finalizeEmailAttachmentUpload,
  prepareEmailAttachmentUpload,
  saveEmailDraft,
  syncInbox,
  updateEmailThreadLinks,
  updateEmailThreadState,
} from "@/features/inbox/actions";
import type {
  EmailMessage,
  InboxActionState,
  InboxData,
  InboxFolder,
  InboxThread,
} from "@/features/inbox/types";
import { filterThreads, formatInboxTimestamp, inboxCounts } from "@/features/inbox/view-model";
import { startSignedUpload } from "@/features/start-a-project/signed-upload";

const FOLDERS: Array<{ id: InboxFolder; label: string; icon: typeof Inbox }> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "all", label: "All Mail", icon: Mail },
  { id: "unread", label: "Unread", icon: MailOpen },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const FOLDER_IDS = new Set<InboxFolder>(FOLDERS.map((folder) => folder.id));

function inboxFolder(value: string | null): InboxFolder {
  return value && FOLDER_IDS.has(value as InboxFolder) ? (value as InboxFolder) : "inbox";
}

type ComposeState = {
  emailId?: string;
  threadId?: string;
  version?: number;
  toEmail: string;
  toName: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
};

type ThreadAction =
  "mark-read" | "mark-unread" | "star" | "unstar" | "archive" | "restore" | "trash";

const EMPTY_COMPOSE: ComposeState = {
  toEmail: "",
  toName: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
};

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function MessageBody({ message }: { message: EmailMessage }) {
  if (message.bodyHtml) {
    const source = `<!doctype html><html><head><meta name="color-scheme" content="light"><style>body{margin:0;color:#171717;background:#fff;font:14px/1.65 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#171717}</style></head><body>${message.bodyHtml}</body></html>`;
    return (
      <iframe
        title={`Message from ${message.fromName ?? message.fromEmail ?? "sender"}`}
        sandbox=""
        srcDoc={source}
        className="min-h-44 w-full border-0 bg-white"
      />
    );
  }
  return <p className="text-sm leading-7 break-words whitespace-pre-wrap">{message.body}</p>;
}

function ComposePane({
  draft,
  setDraft,
  close,
  discard,
  onSaved,
  pending,
}: {
  draft: ComposeState;
  setDraft: (value: ComposeState) => void;
  close: () => void;
  discard: () => void;
  onSaved: (state: InboxActionState) => void;
  pending: boolean;
}) {
  const [advanced, setAdvanced] = useState(Boolean(draft.cc || draft.bcc));
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<Array<{ name: string; size: number }>>([]);
  const [uploadError, setUploadError] = useState("");

  async function submit(intent: "draft" | "send") {
    const state = await saveEmailDraft({ ...draft, intent });
    onSaved(state);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError("");
    let current = draft;
    try {
      for (const file of Array.from(files)) {
        const prepared = await prepareEmailAttachmentUpload({
          draft: current,
          file: { name: file.name, type: file.type, size: file.size },
        });
        if (prepared.status !== "success") throw new Error(prepared.message);
        current = {
          ...current,
          emailId: prepared.emailId,
          threadId: prepared.threadId,
          version: prepared.version,
        };
        setDraft(current);
        await startSignedUpload({
          file,
          uploadUrl: prepared.signedUrl,
          onProgress: () => undefined,
        }).done;
        const finalized = await finalizeEmailAttachmentUpload({
          emailId: prepared.emailId,
          storagePath: prepared.storagePath,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          version: current.version,
        });
        if (finalized.status !== "success") throw new Error(finalized.message);
        if (!finalized.version) throw new Error("The attachment version could not be verified.");
        current = { ...current, version: finalized.version };
        setDraft(current);
        setUploaded((items) => [...items, { name: file.name, size: file.size }]);
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "The attachment could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label="Compose email">
      <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div>
          <p className="text-sm font-semibold">{draft.emailId ? "Edit draft" : "New message"}</p>
          <p className="text-ink-muted text-xs">From LGNDRY.Co</p>
        </div>
        <button type="button" onClick={close} className="p-2" title="Close composer">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close composer</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <label className="border-line flex items-center gap-3 border-b py-3 text-sm">
          <span className="text-ink-muted w-14 shrink-0">To</span>
          <input
            type="email"
            value={draft.toEmail}
            onChange={(event) => setDraft({ ...draft, toEmail: event.target.value })}
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="client@example.com"
            required
          />
          <button type="button" className="text-xs" onClick={() => setAdvanced(!advanced)}>
            Cc/Bcc
          </button>
        </label>
        {advanced ? (
          <>
            <label className="border-line flex items-center gap-3 border-b py-3 text-sm">
              <span className="text-ink-muted w-14 shrink-0">Cc</span>
              <input
                value={draft.cc}
                onChange={(event) => setDraft({ ...draft, cc: event.target.value })}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            <label className="border-line flex items-center gap-3 border-b py-3 text-sm">
              <span className="text-ink-muted w-14 shrink-0">Bcc</span>
              <input
                value={draft.bcc}
                onChange={(event) => setDraft({ ...draft, bcc: event.target.value })}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
          </>
        ) : null}
        <label className="border-line flex items-center gap-3 border-b py-3 text-sm">
          <span className="text-ink-muted w-14 shrink-0">Subject</span>
          <input
            value={draft.subject}
            onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            className="min-w-0 flex-1 bg-transparent outline-none"
            required
          />
        </label>
        <textarea
          aria-label="Message"
          spellCheck
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          placeholder="Write your message..."
          className="mt-4 min-h-72 w-full resize-none bg-transparent text-sm leading-7 outline-none"
          required
        />
        <div className="border-line mt-4 border-t pt-3">
          <label className="border-line inline-flex h-9 cursor-pointer items-center gap-2 border px-3 text-xs font-medium">
            <Paperclip className="size-4" aria-hidden="true" />
            {uploading ? "Uploading..." : "Attach files"}
            <input
              type="file"
              multiple
              disabled={uploading || pending}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.zip,.docx,.xlsx"
              className="sr-only"
              onChange={(event) => uploadFiles(event.target.files)}
            />
          </label>
          {uploaded.length ? (
            <div className="mt-3 space-y-1">
              {uploaded.map((item) => (
                <p key={`${item.name}-${item.size}`} className="text-ink-muted flex gap-2 text-xs">
                  <Paperclip className="size-3.5" aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                  <span>{bytes(item.size)}</span>
                </p>
              ))}
            </div>
          ) : null}
          {uploadError ? (
            <p className="mt-2 text-xs" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>
      <div className="border-line flex shrink-0 items-center justify-between border-t p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending || uploading}
            onClick={() => submit("draft")}
            className="border-line h-10 border px-4 text-sm disabled:opacity-50"
          >
            Save draft
          </button>
          {draft.emailId ? (
            <button
              type="button"
              disabled={pending || uploading}
              onClick={discard}
              className="border-line flex size-10 items-center justify-center border disabled:opacity-50"
              title="Discard draft"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span className="sr-only">Discard draft</span>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          disabled={pending || uploading}
          onClick={() => submit("send")}
          className="bg-ink flex h-10 items-center gap-2 px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden="true" /> Send
        </button>
      </div>
    </section>
  );
}

export function InboxShell({ data, now }: { data: InboxData; now: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folder = inboxFolder(searchParams.get("folder"));
  const [query, setQuery] = useState("");
  const selectedId = searchParams.get("thread");
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [notice, setNotice] = useState("");
  const [linksOpen, setLinksOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"folders" | "list" | "message">("list");
  const [pending, startTransition] = useTransition();
  const counts = useMemo(() => inboxCounts(data.threads), [data.threads]);
  const visibleThreads = useMemo(
    () => filterThreads(data.threads, folder, query),
    [data.threads, folder, query],
  );
  const selected =
    visibleThreads.find((thread) => thread.id === selectedId) ?? visibleThreads[0] ?? null;

  function updateRoute(nextFolder: InboxFolder, threadId?: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFolder === "inbox") params.delete("folder");
    else params.set("folder", nextFolder);
    if (threadId) params.set("thread", threadId);
    else params.delete("thread");
    const queryString = params.toString();
    router.replace(queryString ? `/ops/inbox?${queryString}` : "/ops/inbox", { scroll: false });
  }

  function refreshWith(state: InboxActionState) {
    setNotice(state.message ?? (state.status === "success" ? "Saved." : "Something went wrong."));
    if (state.status === "success") {
      setCompose(null);
      router.refresh();
    }
  }

  function runThreadAction(thread: InboxThread, action: ThreadAction) {
    startTransition(async () => {
      const state = await updateEmailThreadState({
        threadId: thread.id,
        action,
        version: thread.version,
      });
      refreshWith(state);
    });
  }

  function selectThread(thread: InboxThread) {
    setCompose(null);
    setMobilePane("message");
    updateRoute(folder, thread.id);
    if (!thread.isRead) runThreadAction(thread, "mark-read");
  }

  function beginReply(thread: InboxThread) {
    const latest = thread.messages.at(-1);
    setCompose({
      threadId: thread.id,
      version: thread.version,
      toEmail:
        latest?.direction === "Incoming" ? (latest.fromEmail ?? "") : (latest?.toEmail ?? ""),
      toName: latest?.direction === "Incoming" ? (latest.fromName ?? "") : (latest?.toName ?? ""),
      cc: "",
      bcc: "",
      subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
      body: "",
    });
  }

  function editDraft(thread: InboxThread, message: EmailMessage) {
    setCompose({
      emailId: message.id,
      threadId: thread.id,
      version: message.version,
      toEmail: message.toEmail,
      toName: message.toName ?? "",
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      body: message.body,
    });
  }

  function saveLinks(form: HTMLFormElement, thread: InboxThread) {
    const fields = new FormData(form);
    const id = (key: string) => String(fields.get(key) || "") || null;
    startTransition(async () => {
      const state = await updateEmailThreadLinks({
        threadId: thread.id,
        version: thread.version,
        clientId: id("clientId"),
        contactId: id("contactId"),
        enquiryId: id("enquiryId"),
        projectId: id("projectId"),
        quoteId: id("quoteId"),
        invoiceId: id("invoiceId"),
        followUpId: id("followUpId"),
      });
      setLinksOpen(false);
      refreshWith(state);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium">Inbox</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Manage client communications and keep every conversation connected to the work.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => refreshWith(await syncInbox()))}
            className="border-line flex h-10 items-center gap-2 border px-4 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
            Sync
          </button>
          <button
            type="button"
            onClick={() => {
              setCompose(EMPTY_COMPOSE);
              setMobilePane("message");
            }}
            className="bg-ink flex h-10 items-center gap-2 px-5 text-sm font-medium text-white"
          >
            <Pencil className="size-4" aria-hidden="true" /> Compose
          </button>
        </div>
      </div>

      {notice ? (
        <div
          className="border-line bg-surface-soft flex items-center justify-between border px-3 py-2 text-sm"
          role="status"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} title="Dismiss notice">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Dismiss notice</span>
          </button>
        </div>
      ) : null}

      <div className="border-line grid h-[calc(100dvh-13rem)] min-h-[650px] flex-1 overflow-hidden border bg-white lg:grid-cols-[180px_310px_minmax(420px,1fr)] 2xl:grid-cols-[180px_310px_minmax(420px,1fr)_290px]">
        <aside
          className={`${mobilePane === "folders" ? "flex" : "hidden"} border-line min-h-0 flex-col border-r lg:flex`}
        >
          <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">Mailboxes</span>
            <button
              type="button"
              className="lg:hidden"
              onClick={() => setMobilePane("list")}
              title="Show messages"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <nav className="space-y-1 p-2" aria-label="Mailbox folders">
            {FOLDERS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobilePane("list");
                    updateRoute(item.id, null);
                  }}
                  className={`flex h-10 w-full items-center gap-3 px-3 text-sm ${folder === item.id ? "bg-surface-soft font-medium" : "text-ink-muted hover:text-ink"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs tabular-nums">{counts[item.id]}</span>
                </button>
              );
            })}
          </nav>
          <div className="border-line text-ink-muted mt-auto border-t p-4 text-xs leading-5">
            <p>Connected mailbox</p>
            <p className="text-ink mt-1 break-all">neomokgwadi@lgndry-co.co.za</p>
            <p className="mt-2">
              {data.lastSyncedAt
                ? `Synced ${formatInboxTimestamp(data.lastSyncedAt, now)}`
                : "Ready to sync"}
            </p>
          </div>
        </aside>

        <section
          className={`${mobilePane === "list" ? "flex" : "hidden"} border-line min-h-0 flex-col border-r lg:flex`}
          aria-label="Email threads"
        >
          <div className="border-line flex h-14 shrink-0 items-center gap-2 border-b p-2">
            <button
              type="button"
              className="p-2 lg:hidden"
              onClick={() => setMobilePane("folders")}
              title="Show folders"
            >
              <Menu className="size-4" aria-hidden="true" />
            </button>
            <label className="border-line flex h-9 min-w-0 flex-1 items-center gap-2 border px-3">
              <Search className="text-ink-muted size-4" aria-hidden="true" />
              <span className="sr-only">Search emails</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search emails..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleThreads.length ? (
              visibleThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread)}
                  className={`border-line flex w-full gap-3 border-b p-4 text-left ${selected?.id === thread.id ? "bg-surface-soft" : "hover:bg-surface-soft/60"}`}
                >
                  <span
                    className={`mt-2 size-2 shrink-0 rounded-full ${thread.isRead ? "bg-line-strong" : "bg-ink"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <strong
                        className={`truncate text-sm ${thread.isRead ? "font-medium" : "font-semibold"}`}
                      >
                        {thread.participantName}
                      </strong>
                      <span className="text-ink-muted shrink-0 text-xs">
                        {formatInboxTimestamp(thread.latestMessageAt, now)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm font-medium">
                      {thread.subject}
                    </span>
                    <span className="text-ink-muted mt-1 line-clamp-2 text-xs leading-5">
                      {thread.snippet || "No preview available"}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {thread.client ? (
                        <span className="bg-surface-soft px-2 py-1 text-[11px]">
                          {thread.client.label}
                        </span>
                      ) : null}
                      {thread.project ? (
                        <span className="bg-surface-soft px-2 py-1 text-[11px]">Project</span>
                      ) : null}
                      {thread.messages.some((message) => message.attachments.length) ? (
                        <Paperclip
                          className="text-ink-muted ml-auto size-3.5"
                          aria-label="Has attachments"
                        />
                      ) : null}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="text-ink-muted p-8 text-center text-sm">
                No messages in this mailbox.
              </div>
            )}
          </div>
        </section>

        <main
          className={`${mobilePane === "message" ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}
        >
          {compose ? (
            <ComposePane
              draft={compose}
              setDraft={setCompose}
              close={() => setCompose(null)}
              discard={() => {
                if (!compose.emailId) return;
                startTransition(async () =>
                  refreshWith(
                    await deleteEmailDraft({ emailId: compose.emailId, version: compose.version }),
                  ),
                );
              }}
              pending={pending}
              onSaved={(state) => startTransition(async () => refreshWith(state))}
            />
          ) : selected ? (
            <>
              <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-2 lg:hidden"
                    onClick={() => setMobilePane("list")}
                    title="Back to messages"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="p-2"
                    onClick={() =>
                      runThreadAction(selected, selected.archivedAt ? "restore" : "archive")
                    }
                    title={selected.archivedAt ? "Restore" : "Archive"}
                  >
                    <Archive className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="p-2"
                    onClick={() =>
                      runThreadAction(selected, selected.isRead ? "mark-unread" : "mark-read")
                    }
                    title={selected.isRead ? "Mark unread" : "Mark read"}
                  >
                    {selected.isRead ? (
                      <Mail className="size-4" aria-hidden="true" />
                    ) : (
                      <MailOpen className="size-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="p-2"
                    onClick={() => runThreadAction(selected, "trash")}
                    title="Move to trash"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <button type="button" className="p-2" title="More actions">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold break-words">{selected.subject}</h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {selected.client ? (
                        <span className="bg-surface-soft px-2 py-1">{selected.client.label}</span>
                      ) : null}
                      {selected.project ? (
                        <span className="bg-surface-soft px-2 py-1">Project</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-2"
                    onClick={() =>
                      runThreadAction(selected, selected.isStarred ? "unstar" : "star")
                    }
                    title={selected.isStarred ? "Unstar" : "Star"}
                  >
                    <Star
                      className={`size-5 ${selected.isStarred ? "fill-ink" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className="mt-6 space-y-5">
                  {selected.messages.map((message) => (
                    <article key={message.id} className="border-line border-b pb-5 last:border-0">
                      <header className="mb-4 flex items-start gap-3">
                        <span className="bg-surface-soft flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                          {initials(
                            message.direction === "Incoming"
                              ? (message.fromName ?? message.fromEmail ?? "?")
                              : "LGNDRY.Co",
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="truncate text-sm">
                              {message.fromName ?? message.fromEmail ?? "LGNDRY.Co"}
                            </strong>
                            <span className="text-ink-muted text-xs">
                              {formatInboxTimestamp(message.occurredAt, now)}
                            </span>
                          </div>
                          <p className="text-ink-muted truncate text-xs">
                            to {message.toName ?? message.toEmail}
                          </p>
                        </div>
                        {message.status === "Draft" ? (
                          <button
                            type="button"
                            onClick={() => editDraft(selected, message)}
                            className="text-xs underline"
                          >
                            Edit draft
                          </button>
                        ) : null}
                      </header>
                      <MessageBody message={message} />
                      {message.attachments.length ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {message.attachments.map((item) =>
                            item.url ? (
                              <a
                                key={item.id}
                                href={item.url}
                                className="border-line flex items-center gap-3 border p-3 text-sm"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Paperclip className="size-4" aria-hidden="true" />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {item.fileName}
                                  </span>
                                  <span className="text-ink-muted text-xs">
                                    {bytes(item.sizeBytes)}
                                  </span>
                                </span>
                              </a>
                            ) : null,
                          )}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
              <div className="border-line shrink-0 border-t p-3">
                <button
                  type="button"
                  onClick={() => beginReply(selected)}
                  className="border-line flex h-10 items-center gap-2 border px-4 text-sm font-medium"
                >
                  <Reply className="size-4" aria-hidden="true" /> Reply
                </button>
              </div>
            </>
          ) : (
            <div className="text-ink-muted flex h-full items-center justify-center p-8 text-sm">
              Select a conversation or compose a new message.
            </div>
          )}
        </main>

        <aside className="border-line hidden min-h-0 overflow-y-auto border-l p-3 2xl:block">
          {selected ? (
            <div className="space-y-3">
              <section className="border-line border p-4">
                <div className="flex items-center gap-3">
                  <span className="bg-ink flex size-10 items-center justify-center rounded-full text-xs font-medium text-white">
                    {initials(selected.client?.label ?? selected.participantName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selected.client?.label ?? selected.participantName}
                    </p>
                    <p className="text-ink-muted truncate text-xs">
                      {selected.contact?.email ?? selected.participantEmail}
                    </p>
                  </div>
                </div>
                {selected.client ? (
                  <Link
                    href={selected.client.href}
                    className="mt-4 flex items-center justify-between text-sm font-medium"
                  >
                    Open client <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </section>

              <section className="border-line border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Related Items</h3>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setLinksOpen(!linksOpen)}
                  >
                    Edit
                  </button>
                </div>
                {linksOpen ? (
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveLinks(event.currentTarget, selected);
                    }}
                  >
                    {(
                      [
                        ["clientId", "Client", data.options.clients, selected.client?.id],
                        ["contactId", "Contact", data.options.contacts, selected.contact?.id],
                        ["enquiryId", "Enquiry", data.options.enquiries, selected.enquiry?.id],
                        ["projectId", "Project", data.options.projects, selected.project?.id],
                        ["quoteId", "Quote", data.options.quotes, selected.quote?.id],
                        ["invoiceId", "Invoice", data.options.invoices, selected.invoice?.id],
                        ["followUpId", "Follow-up", data.options.followUps, selected.followUp?.id],
                      ] as const
                    ).map(([name, label, choices, current]) => (
                      <label key={name} className="block text-xs">
                        <span className="text-ink-muted mb-1 block">{label}</span>
                        <select
                          name={name}
                          defaultValue={current ?? ""}
                          className="border-line h-9 w-full border bg-white px-2 text-xs"
                        >
                          <option value="">None</option>
                          {choices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <button
                      type="submit"
                      disabled={pending}
                      className="bg-ink mt-2 h-9 w-full text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save links
                    </button>
                  </form>
                ) : (
                  <div className="divide-line mt-3 divide-y">
                    {[
                      selected.enquiry,
                      selected.quote,
                      selected.project,
                      selected.invoice,
                      selected.followUp,
                    ]
                      .filter(Boolean)
                      .map((item) =>
                        item ? (
                          <Link
                            key={`${item.href}:${item.label}`}
                            href={item.href}
                            className="flex items-center justify-between py-2 text-xs"
                          >
                            <span className="truncate">{item.label}</span>
                            <ChevronRight className="size-3.5" aria-hidden="true" />
                          </Link>
                        ) : null,
                      )}
                    {![
                      selected.enquiry,
                      selected.quote,
                      selected.project,
                      selected.invoice,
                      selected.followUp,
                    ].some(Boolean) ? (
                      <p className="text-ink-muted py-3 text-xs">No operational records linked.</p>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="border-line border p-4">
                <h3 className="text-sm font-semibold">Attachments</h3>
                <div className="mt-2 space-y-2">
                  {selected.messages
                    .flatMap((message) => message.attachments)
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{item.fileName}</span>
                        <span className="text-ink-muted">{bytes(item.sizeBytes)}</span>
                      </div>
                    ))}
                  {!selected.messages.some((message) => message.attachments.length) ? (
                    <p className="text-ink-muted text-xs">No attachments.</p>
                  ) : null}
                </div>
              </section>

              <section className="border-line border p-4">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Contact</h3>
                </div>
                <p className="mt-3 text-sm font-medium">
                  {selected.contact?.label ?? selected.participantName}
                </p>
                {selected.contact?.roleTitle ? (
                  <p className="text-ink-muted text-xs">{selected.contact.roleTitle}</p>
                ) : null}
                <p className="text-ink-muted mt-2 text-xs break-all">
                  {selected.contact?.email ?? selected.participantEmail}
                </p>
                {selected.contact?.phone ? (
                  <p className="text-ink-muted mt-1 text-xs">{selected.contact.phone}</p>
                ) : null}
              </section>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
