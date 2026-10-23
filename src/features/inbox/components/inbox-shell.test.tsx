import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxData, InboxThread } from "@/features/inbox/types";
import { InboxShell } from "@/features/inbox/components/inbox-shell";
import { syncInbox } from "@/features/inbox/actions";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/inbox/actions", () => ({
  deleteEmailDraft: vi.fn(),
  finalizeEmailAttachmentUpload: vi.fn(),
  prepareEmailAttachmentUpload: vi.fn(),
  saveEmailDraft: vi.fn(),
  syncInbox: vi.fn(),
  updateEmailThreadLinks: vi.fn(),
  updateEmailThreadState: vi.fn().mockResolvedValue({ status: "success" }),
}));

function thread(overrides: Partial<InboxThread> = {}): InboxThread {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    subject: "Autumn campaign proposal",
    snippet: "The revised treatment looks great.",
    latestMessageAt: "2026-10-21T08:00:00Z",
    messageCount: 1,
    isRead: false,
    isStarred: false,
    archivedAt: null,
    trashedAt: null,
    version: 1,
    participantName: "James Mitchell",
    participantEmail: "james@example.com",
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        direction: "Incoming",
        status: "Inbox",
        fromName: "James Mitchell",
        fromEmail: "james@example.com",
        toName: "LGNDRY.Co",
        toEmail: "studio@example.com",
        cc: "",
        bcc: "",
        subject: "Autumn campaign proposal",
        body: "The revised treatment looks great.",
        bodyHtml: null,
        occurredAt: "2026-10-21T08:00:00Z",
        isRead: false,
        version: 1,
        attachments: [],
      },
    ],
    client: {
      id: "client",
      label: "Blackridge Hotels",
      href: "/ops/clients/client",
      status: "Active",
    },
    contact: null,
    enquiry: null,
    project: null,
    quote: null,
    invoice: null,
    followUp: null,
    ...overrides,
  };
}

const emptyOptions = {
  clients: [],
  contacts: [],
  enquiries: [],
  projects: [],
  quotes: [],
  invoices: [],
  followUps: [],
};

function data(threads = [thread()]): InboxData {
  return { threads, options: emptyOptions, lastSyncedAt: null };
}

const shell = (threads = data()) => (
  <InboxShell
    data={threads}
    now="2026-10-21T10:00:00Z"
    signature={"Kind regards,\nNeo Matime\nLGNDRY.Co"}
  />
);

describe("InboxShell", () => {
  beforeEach(() => {
    refresh.mockReset();
    replace.mockReset();
    vi.mocked(syncInbox).mockReset();
    vi.mocked(syncInbox).mockResolvedValue({
      status: "success",
      message: "0 new emails synchronized.",
    });
    window.localStorage.clear();
  });

  it("renders the reference layout's folders, thread, conversation and context", () => {
    render(shell());
    expect(screen.getByRole("navigation", { name: "Mailbox folders" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /James Mitchell/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Autumn campaign proposal" })).toBeInTheDocument();
    expect(screen.getAllByText("Blackridge Hotels").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Reply/ })).toBeInTheDocument();
  });

  it("opens a functional composer", () => {
    render(shell());
    fireEvent.click(screen.getByRole("button", { name: /Compose/ }));
    expect(screen.getByRole("region", { name: "Compose email" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("client@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert link" })).toBeInTheDocument();
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toContain(
      "Kind regards,\nNeo Matime",
    );
  });

  it("gives each mailbox pane its own scroll region", () => {
    render(shell());
    expect(screen.getByTestId("inbox-folder-scroll")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("inbox-thread-scroll")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("inbox-conversation-scroll")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("inbox-context-scroll")).toHaveClass("overflow-y-auto");
  });

  it("collapses and restores the mailbox rail", () => {
    render(shell());
    fireEvent.click(screen.getByRole("button", { name: "Collapse mailboxes" }));
    expect(screen.getByRole("button", { name: "Expand mailboxes" })).toBeInTheDocument();
    expect(window.localStorage.getItem("lgndry.ops.inbox-folders-collapsed")).toBe("true");
  });

  it("synchronizes automatically when the Inbox opens", async () => {
    render(shell());
    await waitFor(() => expect(syncInbox).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps thread selection in the URL", () => {
    render(shell());
    fireEvent.click(screen.getByRole("button", { name: /James Mitchell/ }));
    expect(replace).toHaveBeenCalledWith("/ops/inbox?thread=00000000-0000-4000-8000-000000000001", {
      scroll: false,
    });
  });

  it("shows an explicit empty mailbox state", () => {
    render(shell(data([])));
    expect(screen.getByText("No messages in this mailbox.")).toBeInTheDocument();
    expect(screen.getByText("Select a conversation or compose a new message.")).toBeInTheDocument();
  });
});
