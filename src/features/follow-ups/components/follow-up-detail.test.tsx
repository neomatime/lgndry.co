import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpDetailView } from "@/features/follow-ups/components/follow-up-detail";
import {
  FOLLOW_UP_ID,
  followUpDetail,
  PREDECESSOR_ID,
  recurringDetail,
  seriesOf,
  SUCCESSOR_ID,
} from "@/features/follow-ups/components/follow-up-test-data";
import type { LinkedArchivedStatus } from "@/features/follow-ups/fetch-linked-archived";
import type { FollowUpDetail } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  cancel: vi.fn(),
  reschedule: vi.fn(),
  reopen: vi.fn(),
  toggle: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/follow-ups/actions", () => ({
  completeFollowUp: mocks.complete,
  cancelFollowUp: mocks.cancel,
  rescheduleFollowUp: mocks.reschedule,
  reopenFollowUp: mocks.reopen,
  setFollowUpChecklistItem: mocks.toggle,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

// 08:00 UTC is 10:00 in Johannesburg on 30 Sep 2026, so a 11:00 due time is still ahead today.
const NOW = "2026-09-30T08:00:00Z";
const NONE: LinkedArchivedStatus = {
  client: false,
  contact: false,
  enquiry: false,
  project: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function renderDetail(
  followUp: FollowUpDetail = followUpDetail(),
  extra: { archived?: LinkedArchivedStatus; updated?: boolean } = {},
) {
  return render(
    <FollowUpDetailView
      followUp={followUp}
      now={NOW}
      archived={extra.archived ?? NONE}
      updated={extra.updated}
    />,
  );
}

const rail = () => screen.getByRole("complementary", { name: "Follow-up details" });

describe("header and summary", () => {
  it("shows the title, reference breadcrumb and a real link back to the list", () => {
    renderDetail();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chase the autumn quote");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Follow-ups" })).toHaveAttribute(
      "href",
      "/ops/follow-ups",
    );
    expect(within(crumbs).getByText("FUP-0312")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Follow-ups" })).toHaveAttribute(
      "href",
      "/ops/follow-ups",
    );
    expect(screen.getByText("James Mitchell · Head of Marketing")).toBeInTheDocument();
  });

  it("shows type, status, priority, due, owner and related item as text", () => {
    renderDetail();
    const text = (label: string) => screen.getByText(label, { selector: "p" }).parentElement!;
    expect(text("Type")).toHaveTextContent("Quote Follow-up");
    expect(text("Status")).toHaveTextContent("Due Today");
    expect(text("Priority")).toHaveTextContent("High");
    // Measured against the server-provided `now`, in Johannesburg.
    expect(text("Due")).toHaveTextContent("Today, 11:00");
    expect(text("Owner")).toHaveTextContent("Liam Parker");
    expect(text("Related Item")).toHaveTextContent("Documentary");
    expect(text("Related Item")).toHaveTextContent("Enquiry");
  });

  it("falls back to the owner's email and then to Unassigned", () => {
    const { unmount } = renderDetail(
      followUpDetail({ owner: { id: "u", name: "", email: "liam@example.com" } }),
    );
    expect(screen.getByText("Owner", { selector: "p" }).parentElement).toHaveTextContent(
      "liam@example.com",
    );
    unmount();
    renderDetail(followUpDetail({ owner: { id: null, name: "", email: "" } }));
    expect(screen.getByText("Owner", { selector: "p" }).parentElement).toHaveTextContent(
      "Unassigned",
    );
  });

  it("shows None when there is no related item", () => {
    renderDetail(followUpDetail({ related: null }));
    expect(screen.getByText("Related Item", { selector: "p" }).parentElement).toHaveTextContent(
      "None",
    );
  });

  it("lets long titles wrap instead of overflowing", () => {
    renderDetail(followUpDetail({ title: "x".repeat(300) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("break-words");
  });
});

describe("Edit link", () => {
  it("is a real link to the edit route for an Open follow-up", () => {
    renderDetail();
    expect(screen.getByRole("link", { name: "Edit Follow-up" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/${FOLLOW_UP_ID}/edit`,
    );
  });

  it.each([
    ["Completed", "Completed"],
    ["Cancelled", "Cancelled"],
  ] as const)("is not offered for a %s follow-up", (status, scheduleState) => {
    renderDetail(followUpDetail({ status, scheduleState }));
    expect(screen.queryByRole("link", { name: "Edit Follow-up" })).not.toBeInTheDocument();
  });
});

describe("tabs", () => {
  it("offers Overview, Checklist and History, and no Communication tab", () => {
    renderDetail();
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Overview", "Checklist", "History"]);
    expect(screen.queryByText(/Communication/)).not.toBeInTheDocument();
  });

  it("shows the overview, notes and checklist progress first", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/wants a fast turnaround/)).toBeInTheDocument();
    expect(screen.getByText("Waiting on internal budget confirmation.")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 completed (50%)")).toBeInTheDocument();
  });

  it("says when there is no overview", () => {
    renderDetail(followUpDetail({ overview: "", notes: "", checklist: [] }));
    expect(screen.getByText("No overview has been added.")).toBeInTheDocument();
  });

  it("shows interactive checklist toggles for an Open follow-up", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("tab", { name: "Checklist" }));
    expect(screen.getByRole("checkbox", { name: /Confirm client feedback/ })).toBeEnabled();
  });

  it("keeps the checklist read-only once the follow-up is finished", () => {
    renderDetail(followUpDetail({ status: "Completed", scheduleState: "Completed" }));
    fireEvent.click(screen.getByRole("tab", { name: "Checklist" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Review quote summary/)).toBeInTheDocument();
  });

  it("lists scoped activity with Johannesburg time on the History tab", () => {
    renderDetail(
      followUpDetail({
        activity: [
          {
            id: "a1",
            message: "Follow-up completed: Chase",
            action: "completed",
            createdAt: "2026-09-29T22:30:00Z",
            relativeTime: "9 hours ago",
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    const item = screen.getByText("Follow-up completed: Chase").closest("li")!;
    expect(item).toHaveTextContent("Wed, 30 Sep 2026, 00:30 · 9 hours ago");
  });

  it("says when there is no history yet", () => {
    renderDetail(followUpDetail({ activity: [] }));
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("shows the outcome and completion time (Johannesburg) for a completed follow-up", () => {
    renderDetail(
      followUpDetail({
        status: "Completed",
        scheduleState: "Completed",
        completedAt: "2026-09-29T22:30:00Z",
        outcome: "Client approved.",
      }),
    );
    expect(screen.getByRole("heading", { name: "Outcome" })).toBeInTheDocument();
    expect(screen.getByText("Client approved.", { exact: false })).toBeInTheDocument();
    expect(within(rail()).getByText("Wed, 30 Sep 2026, 00:30")).toBeInTheDocument();
  });

  it("shows the cancellation reason for a cancelled follow-up", () => {
    renderDetail(
      followUpDetail({
        status: "Cancelled",
        scheduleState: "Cancelled",
        cancelledAt: "2026-09-30T07:00:00Z",
        cancellationReason: "Client went elsewhere.",
      }),
    );
    expect(screen.getByRole("heading", { name: "Cancellation reason" })).toBeInTheDocument();
    expect(screen.getByText(/Client went elsewhere\./)).toBeInTheDocument();
    expect(within(rail()).getByText("Wed, 30 Sep 2026, 09:00")).toBeInTheDocument();
  });
});

describe("right rail", () => {
  it("shows the selected contact with mail and phone links", () => {
    renderDetail();
    const contact = within(rail()).getByRole("region", { name: "Contact Details" });
    expect(within(contact).getByText("James Mitchell")).toBeInTheDocument();
    expect(within(contact).getByRole("link", { name: "james@blackridge.example" })).toHaveAttribute(
      "href",
      "mailto:james@blackridge.example",
    );
    expect(within(contact).getByRole("link", { name: "+27 82 555 0187" })).toHaveAttribute(
      "href",
      "tel:+27 82 555 0187",
    );
  });

  it("omits the contact card when no contact is selected", () => {
    renderDetail(followUpDetail({ contact: null }));
    expect(screen.queryByRole("region", { name: "Contact Details" })).not.toBeInTheDocument();
    expect(screen.getByText("Blackridge Hotels", { selector: "p" })).toBeInTheDocument();
  });

  it("links the client and an enquiry with real links", () => {
    renderDetail();
    const linked = within(rail()).getByRole("region", { name: "Linked Records" });
    expect(within(linked).getByRole("link", { name: "Blackridge Hotels" })).toHaveAttribute(
      "href",
      "/ops/clients/client-1",
    );
    expect(within(linked).getByRole("link", { name: "Documentary" })).toHaveAttribute(
      "href",
      "/ops/enquiries/enquiry-1",
    );
  });

  it("links a related project to the project page", () => {
    renderDetail(
      followUpDetail({ related: { id: "project-9", label: "Autumn Campaign", kind: "Project" } }),
    );
    expect(within(rail()).getByRole("link", { name: "Autumn Campaign" })).toHaveAttribute(
      "href",
      "/ops/projects/project-9",
    );
  });

  it("labels archived linked records instead of hiding them", () => {
    renderDetail(followUpDetail(), {
      archived: { client: true, contact: true, enquiry: true, project: false },
    });
    const linked = within(rail()).getByRole("region", { name: "Linked Records" });
    expect(within(linked).getAllByText("(Archived)")).toHaveLength(2);
    expect(within(linked).getByRole("link", { name: "Documentary" })).toBeInTheDocument();
    expect(
      within(within(rail()).getByRole("region", { name: "Contact Details" })).getByText(
        "(Archived)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Enquiry (Archived)")).toBeInTheDocument();
  });

  it("labels an archived related project too", () => {
    renderDetail(
      followUpDetail({ related: { id: "project-9", label: "Autumn Campaign", kind: "Project" } }),
      { archived: { ...NONE, project: true } },
    );
    expect(screen.getByText("Project (Archived)")).toBeInTheDocument();
  });

  it("does not label live records as archived", () => {
    renderDetail();
    expect(screen.queryByText(/Archived/)).not.toBeInTheDocument();
  });

  it("shows no recurrence card for a one-off follow-up", () => {
    renderDetail();
    expect(screen.queryByRole("region", { name: "Recurrence" })).not.toBeInTheDocument();
  });

  it("summarises the recurrence and links the previous and next occurrences", () => {
    renderDetail(
      recurringDetail({
        series: seriesOf({ maxOccurrences: 10 }),
        occurrenceNumber: 2,
        predecessorId: PREDECESSOR_ID,
        successorId: SUCCESSOR_ID,
        status: "Completed",
        scheduleState: "Completed",
      }),
    );
    const recurrence = within(rail()).getByRole("region", { name: "Recurrence" });
    expect(recurrence).toHaveTextContent("Weekly on Mon for 10 occurrences");
    expect(recurrence).toHaveTextContent("#2 of 10");
    expect(recurrence).toHaveTextContent("Active");
    expect(
      within(recurrence).getByRole("link", { name: "View previous occurrence" }),
    ).toHaveAttribute("href", `/ops/follow-ups/${PREDECESSOR_ID}`);
    expect(within(recurrence).getByRole("link", { name: "View next occurrence" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/${SUCCESSOR_ID}`,
    );
  });

  it("shows an ended series as ended", () => {
    renderDetail(recurringDetail({ series: seriesOf({ active: false }) }));
    expect(within(rail()).getByRole("region", { name: "Recurrence" })).toHaveTextContent("Ended");
  });

  it("shows the due date in full and creation time in Johannesburg", () => {
    renderDetail();
    const schedule = within(rail()).getByRole("region", { name: "Schedule" });
    expect(schedule).toHaveTextContent("Wed, 30 Sep 2026, 11:00");
    expect(schedule).toHaveTextContent("Sun, 20 Sep 2026, 10:00");
  });
});

describe("edit-success notice", () => {
  it("announces a calm confirmation after an edit", () => {
    renderDetail(followUpDetail(), { updated: true });
    expect(screen.getByRole("status")).toHaveTextContent("Follow-up updated.");
  });

  it("shows nothing when the page was not reached from an edit", () => {
    renderDetail();
    expect(screen.queryByText("Follow-up updated.")).not.toBeInTheDocument();
  });
});

describe("lifecycle outcomes on the page", () => {
  it("announces completion with a link to the created next occurrence and moves focus to the title", async () => {
    mocks.complete.mockResolvedValue({
      status: "success",
      followUpId: FOLLOW_UP_ID,
      successorId: SUCCESSOR_ID,
    });
    renderDetail(recurringDetail(), { updated: true });
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    const status = await screen.findByText(/The next occurrence has been created/);
    expect(
      within(screen.getByRole("status")).getByRole("link", { name: "View next occurrence" }),
    ).toHaveAttribute("href", `/ops/follow-ups/${SUCCESSOR_ID}`);
    expect(status).toBeInTheDocument();
    // The notice replaces the earlier "updated" message rather than stacking on it.
    expect(screen.queryByText("Follow-up updated.")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("sends the version from the rendered follow-up, so fresh data means a fresh version", async () => {
    mocks.reschedule.mockResolvedValue({ status: "success", followUpId: FOLLOW_UP_ID });
    const view = renderDetail(followUpDetail({ version: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2026-10-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    await waitFor(() =>
      expect(mocks.reschedule).toHaveBeenCalledWith(FOLLOW_UP_ID, 4, expect.anything()),
    );

    // The server re-renders with the bumped version after the refresh.
    view.rerender(
      <FollowUpDetailView
        followUp={followUpDetail({ version: 5, dueDate: "2026-10-05" })}
        now={NOW}
        archived={NONE}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2026-10-06" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalledTimes(2));
    expect(mocks.reschedule.mock.calls[1]![1]).toBe(5);
  });

  it("swaps Mark Complete for Reopen once the refreshed data says Completed", () => {
    const view = renderDetail();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
    view.rerender(
      <FollowUpDetailView
        followUp={followUpDetail({ status: "Completed", scheduleState: "Completed", version: 5 })}
        now={NOW}
        archived={NONE}
      />,
    );
    expect(screen.queryByRole("button", { name: "Mark Complete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit Follow-up" })).not.toBeInTheDocument();
  });

  it("explains why a recurring occurrence with a successor cannot be reopened", () => {
    renderDetail(
      recurringDetail({
        status: "Completed",
        scheduleState: "Completed",
        successorId: SUCCESSOR_ID,
      }),
    );
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    expect(screen.getByText(/can't be reopened/)).toBeInTheDocument();
  });
});
