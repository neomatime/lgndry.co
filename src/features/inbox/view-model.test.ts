import { describe, expect, it } from "vitest";
import { filterThreads, inboxCounts, threadInFolder } from "@/features/inbox/view-model";
import type { InboxThread } from "@/features/inbox/types";

function thread(overrides: Partial<InboxThread> = {}): InboxThread {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    subject: "Campaign proposal",
    snippet: "Please review the proposal",
    latestMessageAt: "2026-10-21T08:00:00Z",
    messageCount: 1,
    isRead: false,
    isStarred: false,
    archivedAt: null,
    trashedAt: null,
    version: 1,
    participantName: "Neo Matime",
    participantEmail: "neo@example.com",
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        direction: "Incoming",
        status: "Inbox",
        fromName: "Neo Matime",
        fromEmail: "neo@example.com",
        toName: "LGNDRY.Co",
        toEmail: "studio@example.com",
        cc: "",
        bcc: "",
        subject: "Campaign proposal",
        body: "Please review the proposal",
        bodyHtml: null,
        occurredAt: "2026-10-21T08:00:00Z",
        isRead: false,
        version: 1,
        attachments: [],
      },
    ],
    client: null,
    contact: null,
    enquiry: null,
    project: null,
    quote: null,
    invoice: null,
    followUp: null,
    ...overrides,
  };
}

describe("Inbox view model", () => {
  it("keeps archived and trashed threads out of Inbox", () => {
    expect(threadInFolder(thread(), "inbox")).toBe(true);
    expect(threadInFolder(thread({ archivedAt: "2026-10-21T09:00:00Z" }), "inbox")).toBe(false);
    expect(threadInFolder(thread({ trashedAt: "2026-10-21T09:00:00Z" }), "inbox")).toBe(false);
  });

  it("counts mailbox views independently", () => {
    const counts = inboxCounts([
      thread(),
      thread({ id: "2", isRead: true, isStarred: true }),
      thread({ id: "3", archivedAt: "2026-10-21T09:00:00Z" }),
    ]);
    expect(counts.inbox).toBe(2);
    expect(counts.unread).toBe(1);
    expect(counts.starred).toBe(1);
    expect(counts.archive).toBe(1);
  });

  it("searches linked record names and message content", () => {
    const rows = [
      thread({ client: { id: "1", label: "Blackridge Hotels", href: "/x", status: "Active" } }),
    ];
    expect(filterThreads(rows, "all", "blackridge")).toHaveLength(1);
    expect(filterThreads(rows, "all", "not present")).toHaveLength(0);
  });
});
