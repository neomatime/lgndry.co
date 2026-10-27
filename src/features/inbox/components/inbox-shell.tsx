"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  ArrowLeft,
  Bold,
  ChevronRight,
  Eye,
  FileText,
  Inbox,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mail,
  MailOpen,
  Menu,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
  Underline,
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
  EmailAttachment,
  EmailMessage,
  InboxActionState,
  InboxData,
  InboxFolder,
  InboxThread,
} from "@/features/inbox/types";
import {
  appendSignature,
  emailHtmlToMarkup,
  emailMarkupToHtml,
  removeSignature,
} from "@/features/inbox/email-formatting";
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
const MAILBOX_RAIL_KEY = "lgndry.ops.inbox-folders-collapsed";
export const INBOX_AUTO_SYNC_INTERVAL_MS = 60_000;

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
  attachments: Array<Pick<EmailAttachment, "fileName" | "sizeBytes"> & { id?: string }>;
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
  attachments: [],
};

type ComposerFormat = "bold" | "italic" | "underline" | "bullet" | "numbered" | "link";

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
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
    },
    [message.bodyHtml],
  );

  if (message.bodyHtml) {
    const source = `<!doctype html><html><head><meta name="color-scheme" content="light"><style>html,body{scrollbar-width:none}::-webkit-scrollbar{display:none;width:0;height:0}body{margin:0;color:#171717;background:#fff;font:14px/1.65 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#171717}</style></head><body>${message.bodyHtml}</body></html>`;
    return (
      <iframe
        title={`Message from ${message.fromName ?? message.fromEmail ?? "sender"}`}
        sandbox="allow-same-origin"
        srcDoc={source}
        className="h-44 min-h-44 w-full border-0 bg-white"
        onLoad={(event) => {
          const frame = event.currentTarget;
          const document = frame.contentDocument;
          if (!document) return;

          const resize = () => {
            frame.style.height = `${Math.max(
              176,
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
            )}px`;
          };

          observerRef.current?.disconnect();
          resize();
          if (typeof ResizeObserver !== "undefined") {
            observerRef.current = new ResizeObserver(resize);
            observerRef.current.observe(document.body);
          }
        }}
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
  signature,
}: {
  draft: ComposeState;
  setDraft: (value: ComposeState) => void;
  close: () => void;
  discard: () => void;
  onSaved: (state: InboxActionState) => void;
  pending: boolean;
  signature: string;
}) {
  const [advanced, setAdvanced] = useState(Boolean(draft.cc || draft.bcc));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percentage: number } | null>(
    null,
  );
  const [uploadError, setUploadError] = useState("");
  const [preview, setPreview] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  async function submit(intent: "draft" | "send") {
    const state = await saveEmailDraft({
      ...draft,
      body: appendSignature(draft.body, signature),
      intent,
    });
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
          draft: { ...current, body: appendSignature(current.body, signature) },
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
        setUploadProgress({ name: file.name, percentage: 0 });
        await startSignedUpload({
          file,
          uploadUrl: prepared.signedUrl,
          onProgress: (percentage) => setUploadProgress({ name: file.name, percentage }),
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
        current = {
          ...current,
          attachments: [...current.attachments, { fileName: file.name, sizeBytes: file.size }],
        };
        setDraft(current);
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "The attachment could not be uploaded.",
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function applyFormat(format: ComposerFormat) {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = draft.body.slice(start, end);
    let replacement = selected;

    if (format === "bold") replacement = `**${selected || "bold text"}**`;
    if (format === "italic") replacement = `_${selected || "italic text"}_`;
    if (format === "underline") replacement = `[u]${selected || "underlined text"}[/u]`;
    if (format === "bullet") {
      replacement = (selected || "list item")
        .split("\n")
        .map((line) => `- ${line.replace(/^\s*(?:-|\d+\.)\s+/, "")}`)
        .join("\n");
    }
    if (format === "numbered") {
      replacement = (selected || "list item")
        .split("\n")
        .map((line, index) => `${index + 1}. ${line.replace(/^\s*(?:-|\d+\.)\s+/, "")}`)
        .join("\n");
    }
    if (format === "link") {
      const url = window.prompt("Paste the web address");
      if (!url || !/^(https?:\/\/|mailto:)/i.test(url)) return;
      replacement = `[${selected || "link text"}](${url})`;
    }

    const body = `${draft.body.slice(0, start)}${replacement}${draft.body.slice(end)}`;
    setDraft({ ...draft, body });
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start, start + replacement.length);
    });
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
        <div className="border-line mt-4 border">
          <div className="border-line bg-surface-soft flex flex-wrap items-center gap-1 border-b p-2">
            {(
              [
                ["bold", "Bold", Bold],
                ["italic", "Italic", Italic],
                ["underline", "Underline", Underline],
                ["bullet", "Bulleted list", List],
                ["numbered", "Numbered list", ListOrdered],
                ["link", "Insert link", LinkIcon],
              ] as const
            ).map(([format, label, Icon]) => (
              <button
                key={format}
                type="button"
                onClick={() => applyFormat(format)}
                className="hover:bg-surface flex size-8 items-center justify-center"
                title={label}
                aria-label={label}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreview((value) => !value)}
              className="hover:bg-surface ml-auto flex h-8 items-center gap-2 px-2 text-xs font-medium"
            >
              <Eye className="size-4" aria-hidden="true" /> {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div
              className="min-h-72 p-4 text-sm leading-7 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
              aria-label="Message preview"
              dangerouslySetInnerHTML={{
                __html: emailMarkupToHtml(appendSignature(draft.body, signature)),
              }}
            />
          ) : (
            <>
              <textarea
                ref={editorRef}
                aria-label="Message"
                spellCheck
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                placeholder="Write your message..."
                className="min-h-56 w-full resize-none bg-transparent p-4 text-sm leading-7 outline-none"
                required
              />
              <div
                className="border-line border-t p-4 [&_img]:h-auto [&_img]:w-full [&_img]:max-w-[680px]"
                aria-label="Email banner"
                dangerouslySetInnerHTML={{ __html: emailMarkupToHtml(signature) }}
              />
            </>
          )}
        </div>
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
          {uploadProgress ? (
            <div className="mt-3" role="status">
              <div className="text-ink-muted flex justify-between gap-3 text-xs">
                <span className="truncate">Uploading {uploadProgress.name}</span>
                <span>{Math.round(uploadProgress.percentage)}%</span>
              </div>
              <div className="bg-surface-soft mt-2 h-1 overflow-hidden">
                <div
                  className="bg-ink h-full transition-[width]"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
            </div>
          ) : null}
          {draft.attachments.length ? (
            <div className="mt-3 space-y-1">
              {draft.attachments.map((item) => (
                <p
                  key={item.id ?? `${item.fileName}-${item.sizeBytes}`}
                  className="text-ink-muted flex gap-2 text-xs"
                >
                  <Paperclip className="size-3.5" aria-hidden="true" />
                  <span className="truncate">{item.fileName}</span>
                  <span>{bytes(item.sizeBytes)}</span>
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

export function InboxShell({
  data,
  now,
  signature,
}: {
  data: InboxData;
  now: string;
  signature: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folder = inboxFolder(searchParams.get("folder"));
  const [query, setQuery] = useState("");
  const selectedId = searchParams.get("thread");
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [notice, setNotice] = useState("");
  const [linksOpen, setLinksOpen] = useState(false);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [mobilePane, setMobilePane] = useState<"folders" | "list" | "message">("list");
  const [pending, startTransition] = useTransition();
  const autoSyncing = useRef(false);
  const counts = useMemo(() => inboxCounts(data.threads), [data.threads]);
  const visibleThreads = useMemo(
    () => filterThreads(data.threads, folder, query),
    [data.threads, folder, query],
  );
  const selected =
    visibleThreads.find((thread) => thread.id === selectedId) ?? visibleThreads[0] ?? null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFoldersCollapsed(window.localStorage.getItem(MAILBOX_RAIL_KEY) === "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    const synchronize = async () => {
      if (document.visibilityState === "hidden" || autoSyncing.current) return;
      autoSyncing.current = true;
      try {
        const state = await syncInbox();
        if (!active) return;
        if (state.status === "success") {
          if (/^[1-9]\d* new email/.test(state.message ?? "")) setNotice(state.message ?? "");
          router.refresh();
        } else if (state.message) {
          setNotice(state.message);
        }
      } catch (error) {
        console.error("Inbox auto-sync failed", error);
      } finally {
        autoSyncing.current = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void synchronize();
    };
    void synchronize();
    const interval = window.setInterval(synchronize, INBOX_AUTO_SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  function toggleFoldersCollapsed() {
    setFoldersCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(MAILBOX_RAIL_KEY, String(next));
      return next;
    });
  }

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
      attachments: [],
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
      body: removeSignature(
        message.bodyHtml ? emailHtmlToMarkup(message.bodyHtml) : message.body,
        signature,
      ),
      attachments: message.attachments.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        sizeBytes: item.sizeBytes,
      })),
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
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
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
            onClick={() =>
              startTransition(async () => {
                const state = await syncInbox();
                setNotice(
                  state.message ??
                    (state.status === "success" ? "Mailbox synchronized." : "Sync failed."),
                );
                if (state.status === "success") router.refresh();
              })
            }
            className="border-line flex h-10 items-center gap-2 border px-4 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
            Sync
          </button>
          <button
            type="button"
            onClick={() => {
              setCompose({ ...EMPTY_COMPOSE });
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

      <div
        className={`border-line grid min-h-0 flex-1 overflow-hidden border bg-white transition-[grid-template-columns] duration-[var(--ops-motion-standard)] ${
          foldersCollapsed
            ? "lg:grid-cols-[52px_310px_minmax(420px,1fr)] 2xl:grid-cols-[52px_310px_minmax(420px,1fr)_290px]"
            : "lg:grid-cols-[180px_310px_minmax(420px,1fr)] 2xl:grid-cols-[180px_310px_minmax(420px,1fr)_290px]"
        }`}
      >
        <aside
          className={`${mobilePane === "folders" ? "flex" : "hidden"} border-line min-h-0 flex-col border-r lg:flex`}
        >
          <div
            className={`border-line flex h-14 shrink-0 items-center border-b ${foldersCollapsed ? "justify-center px-1" : "justify-between px-4"}`}
          >
            <span className={foldersCollapsed ? "lg:sr-only" : "text-sm font-semibold"}>
              Mailboxes
            </span>
            <button
              type="button"
              onClick={toggleFoldersCollapsed}
              className="hidden size-8 items-center justify-center lg:flex"
              title={foldersCollapsed ? "Expand mailboxes" : "Collapse mailboxes"}
              aria-label={foldersCollapsed ? "Expand mailboxes" : "Collapse mailboxes"}
            >
              {foldersCollapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="lg:hidden"
              onClick={() => setMobilePane("list")}
              title="Show messages"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <nav
            className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
            aria-label="Mailbox folders"
            data-testid="inbox-folder-scroll"
          >
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
                  title={foldersCollapsed ? `${item.label}: ${counts[item.id]}` : undefined}
                  className={`flex h-10 w-full items-center gap-3 text-sm ${foldersCollapsed ? "justify-center px-1" : "px-3"} ${folder === item.id ? "bg-surface-soft font-medium" : "text-ink-muted hover:text-ink"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className={foldersCollapsed ? "lg:sr-only" : "flex-1 text-left"}>
                    {item.label}
                  </span>
                  <span className={foldersCollapsed ? "lg:sr-only" : "text-xs tabular-nums"}>
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </nav>
          <div
            className={`border-line text-ink-muted shrink-0 border-t p-4 text-xs leading-5 ${foldersCollapsed ? "lg:hidden" : ""}`}
          >
            <p>Connected mailbox</p>
            <p className="text-ink mt-1 break-all">neomokgwadi@lgndry-co.co.za</p>
            <p className="mt-2">
              {data.lastSyncedAt
                ? `Synced ${formatInboxTimestamp(data.lastSyncedAt, now)}`
                : "Auto-sync active"}
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
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            data-testid="inbox-thread-scroll"
          >
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
              signature={signature}
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
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
                data-testid="inbox-conversation-scroll"
              >
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

        <aside
          className="border-line hidden min-h-0 overflow-y-auto overscroll-contain border-l p-3 2xl:block"
          data-testid="inbox-context-scroll"
        >
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
