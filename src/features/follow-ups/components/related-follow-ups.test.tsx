import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";
import {
  addFollowUpHref,
  RelatedFollowUps,
} from "@/features/follow-ups/components/related-follow-ups";
import { buildRelatedFollowUps } from "@/features/follow-ups/related-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

// Wednesday 30 September 2026, 10:00 in Johannesburg.
const NOW = new Date("2026-09-30T08:00:00Z");
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const ENQUIRY_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";

function row(overrides: Partial<FollowUpListItem>): FollowUpListItem {
  return followUpDetail({
    related: null,
    contact: null,
    checklist: [],
    ...overrides,
  });
}

const ROWS = [
  row({
    id: "fu-upcoming",
    reference: "FUP-0003",
    title: "Send the revised treatment",
    displayType: "Proposal Review",
    dueDate: "2026-10-05",
    dueTime: "",
    priority: "Low",
  }),
  row({
    id: "fu-today",
    reference: "FUP-0002",
    title: "Chase the autumn quote",
    displayType: "Quote Follow-up",
    dueDate: "2026-09-30",
    dueTime: "11:00",
    priority: "High",
  }),
  row({
    id: "fu-overdue",
    reference: "FUP-0001",
    title: "Confirm the deposit",
    displayType: "Deposit Reminder",
    dueDate: "2026-09-28",
    dueTime: "",
    priority: "Medium",
  }),
  row({
    id: "fu-done",
    reference: "FUP-0004",
    title: "Thank the client",
    status: "Completed",
    dueDate: "2026-09-20",
    dueTime: "",
    // 00:30 on 30 September in Johannesburg, still 29 September in UTC.
    completedAt: "2026-09-29T22:30:00Z",
  }),
  row({
    id: "fu-cancelled",
    reference: "FUP-0005",
    title: "Book the venue visit",
    status: "Cancelled",
    dueDate: "2026-09-22",
    dueTime: "",
    cancelledAt: "2026-09-25T10:00:00Z",
  }),
];

function renderRelated(
  props: Partial<React.ComponentProps<typeof RelatedFollowUps>> = {},
  rows: FollowUpListItem[] = ROWS,
) {
  return render(
    <RelatedFollowUps
      related={buildRelatedFollowUps(rows, NOW)}
      subject="enquiry"
      add={{ clientId: CLIENT_ID, enquiryId: ENQUIRY_ID }}
      canAdd
      {...props}
    />,
  );
}

describe("addFollowUpHref", () => {
  it("uses exactly the query names the create form reads, in a stable order", () => {
    expect(addFollowUpHref({ clientId: CLIENT_ID })).toBe(
      `/ops/follow-ups/new?clientId=${CLIENT_ID}`,
    );
    expect(addFollowUpHref({ clientId: CLIENT_ID, enquiryId: ENQUIRY_ID })).toBe(
      `/ops/follow-ups/new?clientId=${CLIENT_ID}&enquiryId=${ENQUIRY_ID}`,
    );
    expect(addFollowUpHref({ clientId: CLIENT_ID, projectId: PROJECT_ID })).toBe(
      `/ops/follow-ups/new?clientId=${CLIENT_ID}&projectId=${PROJECT_ID}`,
    );
    expect(addFollowUpHref({ projectId: PROJECT_ID, contactId: "c-1", clientId: CLIENT_ID })).toBe(
      `/ops/follow-ups/new?clientId=${CLIENT_ID}&contactId=c-1&projectId=${PROJECT_ID}`,
    );
  });

  it("leaves out empty optional values", () => {
    expect(addFollowUpHref({ clientId: CLIENT_ID, contactId: "", enquiryId: undefined })).toBe(
      `/ops/follow-ups/new?clientId=${CLIENT_ID}`,
    );
  });
});

describe("RelatedFollowUps", () => {
  it("groups follow-ups into Open, Completed and Cancelled with counts", () => {
    renderRelated();
    expect(screen.getByText("5 follow-ups")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open (3)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancelled (1)" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Completed" })).getAllByRole("listitem"),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole("list", { name: "Cancelled" })).getAllByRole("listitem"),
    ).toHaveLength(1);
  });

  it("orders open follow-ups overdue first, then today, then upcoming", () => {
    renderRelated();
    const open = within(screen.getByRole("list", { name: "Open" })).getAllByRole("link");
    expect(open.map((link) => link.textContent)).toEqual([
      "Confirm the deposit",
      "Chase the autumn quote",
      "Send the revised treatment",
    ]);
  });

  it("shows reference, type, due label, priority and a text status for every row", () => {
    renderRelated();
    const overdue = screen.getByRole("link", { name: "Confirm the deposit" }).closest("li")!;
    expect(overdue).toHaveTextContent("FUP-0001");
    expect(overdue).toHaveTextContent("Overdue");
    expect(overdue).toHaveTextContent("Medium");
    expect(overdue).toHaveTextContent("Deposit Reminder · Due Mon, 28 Sep");

    const today = screen.getByRole("link", { name: "Chase the autumn quote" }).closest("li")!;
    expect(today).toHaveTextContent("Due Today");
    expect(today).toHaveTextContent("High");
    expect(today).toHaveTextContent("Quote Follow-up · Due Today, 11:00");

    const upcoming = screen
      .getByRole("link", { name: "Send the revised treatment" })
      .closest("li")!;
    expect(upcoming).toHaveTextContent("Upcoming");
    expect(upcoming).toHaveTextContent("Low");
  });

  it("labels completed and cancelled rows with their Johannesburg calendar day", () => {
    renderRelated();
    const done = screen.getByRole("link", { name: "Thank the client" }).closest("li")!;
    expect(done).toHaveTextContent("Completed Wed, 30 Sep 2026");
    expect(within(done).getByText("Completed", { selector: "span" })).toBeInTheDocument();
    const cancelled = screen.getByRole("link", { name: "Book the venue visit" }).closest("li")!;
    expect(cancelled).toHaveTextContent("Cancelled Fri, 25 Sep 2026");
  });

  it("links every follow-up to its detail page with a real link", () => {
    renderRelated();
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    for (const id of ["fu-upcoming", "fu-today", "fu-overdue", "fu-done", "fu-cancelled"]) {
      expect(hrefs).toContain(`/ops/follow-ups/${id}`);
    }
    expect(screen.getByRole("link", { name: "Confirm the deposit" }).tagName).toBe("A");
  });

  it("offers Add Follow-up as a real link with the exact preselection query", () => {
    renderRelated();
    const add = screen.getByRole("link", { name: "Add Follow-up" });
    expect(add.tagName).toBe("A");
    expect(add).toHaveAttribute(
      "href",
      `/ops/follow-ups/new?clientId=${CLIENT_ID}&enquiryId=${ENQUIRY_ID}`,
    );
    expect(add.closest("button")).toBeNull();
    expect(add.querySelector("button")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the project param for a project's add link", () => {
    renderRelated({ subject: "project", add: { clientId: CLIENT_ID, projectId: PROJECT_ID } });
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/new?clientId=${CLIENT_ID}&projectId=${PROJECT_ID}`,
    );
  });

  it("hides Add Follow-up and explains why when the parent cannot take new follow-ups", () => {
    renderRelated({
      canAdd: false,
      addBlockedReason: "This enquiry is archived, so new follow-ups can't be added.",
    });
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/This enquiry is archived/)).toBeInTheDocument();
    // The history is still listed.
    expect(screen.getByRole("heading", { name: "Open (3)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thank the client" })).toBeInTheDocument();
  });

  it("shows a friendly empty state with the add link", () => {
    renderRelated({ subject: "client" }, []);
    expect(screen.getByText("0 follow-ups")).toBeInTheDocument();
    expect(screen.getByText(/No follow-ups are linked to this client yet/)).toBeInTheDocument();
    expect(screen.getByText(/Add one to keep track of the next step/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("does not invite adding in the empty state when adding is unavailable", () => {
    renderRelated({ canAdd: false, addBlockedReason: "Archived." }, []);
    expect(screen.getByText(/No follow-ups are linked to this enquiry yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Add one/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
  });

  it("omits groups that have no follow-ups and singularises the count", () => {
    renderRelated({}, [ROWS[1]!]);
    expect(screen.getByText("1 follow-up")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Completed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Cancelled/ })).not.toBeInTheDocument();
  });

  it("evaluates states and labels against the server-provided now, not the browser clock", () => {
    // The same rows, shaped a day later: the one due earlier is now overdue and "Yesterday".
    // Nothing in the component reads `new Date()` without an argument.
    const tomorrow = new Date("2026-10-01T08:00:00Z");
    render(
      <RelatedFollowUps
        related={buildRelatedFollowUps([ROWS[1]!, ROWS[2]!], tomorrow)}
        subject="enquiry"
        add={{ clientId: CLIENT_ID, enquiryId: ENQUIRY_ID }}
        canAdd
      />,
    );
    const today = screen.getByRole("link", { name: "Chase the autumn quote" }).closest("li")!;
    expect(today).toHaveTextContent("Overdue");
    expect(today).toHaveTextContent("Yesterday, 11:00");
  });

  it("shows each follow-up's own enquiry or project when asked", () => {
    renderRelated({ subject: "client", showRelated: true }, [
      row({
        id: "fu-enq",
        title: "Chase the autumn quote",
        related: { id: "enq-1", label: "Documentary", kind: "Enquiry" },
      }),
      row({
        id: "fu-proj",
        title: "Review the cut",
        related: { id: "proj-1", label: "Autumn Resort Campaign", kind: "Project" },
      }),
      row({ id: "fu-none", title: "Say hello", related: null }),
    ]);
    expect(screen.getByRole("link", { name: "Documentary" })).toHaveAttribute(
      "href",
      "/ops/enquiries/enq-1",
    );
    expect(screen.getByRole("link", { name: "Autumn Resort Campaign" })).toHaveAttribute(
      "href",
      "/ops/projects/proj-1",
    );
    expect(screen.getByText("Say hello").closest("li")).not.toHaveTextContent("Enquiry:");
  });

  it("does not show the related record unless asked", () => {
    renderRelated({}, [row({ related: { id: "enq-1", label: "Documentary", kind: "Enquiry" } })]);
    expect(screen.queryByRole("link", { name: "Documentary" })).not.toBeInTheDocument();
  });

  it("wraps long titles instead of overflowing", () => {
    renderRelated({}, [row({ title: "A".repeat(200) })]);
    expect(screen.getByRole("link", { name: "A".repeat(200) }).closest("p")).toHaveClass(
      "break-words",
    );
  });
});
