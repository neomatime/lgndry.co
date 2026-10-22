import type { InboxFolder, InboxThread } from "@/features/inbox/types";

export type InboxCounts = Record<InboxFolder, number>;

function hasDirection(thread: InboxThread, direction: EmailMessageDirection) {
  return thread.messages.some((message) => message.direction === direction);
}

type EmailMessageDirection = "Incoming" | "Outgoing" | "Internal";

export function threadInFolder(thread: InboxThread, folder: InboxFolder) {
  if (folder === "trash") return Boolean(thread.trashedAt);
  if (thread.trashedAt) return false;
  if (folder === "archive") return Boolean(thread.archivedAt);
  if (thread.archivedAt) return folder === "all";
  if (folder === "all") return true;
  if (folder === "unread") return !thread.isRead;
  if (folder === "starred") return thread.isStarred;
  if (folder === "sent") return hasDirection(thread, "Outgoing");
  if (folder === "drafts") return thread.messages.some((message) => message.status === "Draft");
  return hasDirection(thread, "Incoming");
}

export function inboxCounts(threads: InboxThread[]): InboxCounts {
  return {
    inbox: threads.filter((thread) => threadInFolder(thread, "inbox")).length,
    all: threads.filter((thread) => threadInFolder(thread, "all")).length,
    unread: threads.filter((thread) => threadInFolder(thread, "unread")).length,
    starred: threads.filter((thread) => threadInFolder(thread, "starred")).length,
    sent: threads.filter((thread) => threadInFolder(thread, "sent")).length,
    drafts: threads.filter((thread) => threadInFolder(thread, "drafts")).length,
    archive: threads.filter((thread) => threadInFolder(thread, "archive")).length,
    trash: threads.filter((thread) => threadInFolder(thread, "trash")).length,
  };
}

export function filterThreads(threads: InboxThread[], folder: InboxFolder, query: string) {
  const needle = query.trim().toLowerCase();
  return threads.filter((thread) => {
    if (!threadInFolder(thread, folder)) return false;
    if (!needle) return true;
    return [
      thread.subject,
      thread.snippet,
      thread.participantName,
      thread.participantEmail,
      thread.client?.label,
      thread.project?.label,
      ...thread.messages.flatMap((message) => [message.body, message.fromEmail, message.toEmail]),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
}

export function formatInboxTimestamp(value: string, now: string) {
  const date = new Date(value);
  const current = new Date(now);
  const sameDay =
    date.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" }) ===
    current.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" });
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { day: "2-digit", month: "short" }),
  }).format(date);
}
