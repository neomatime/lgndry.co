import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowUpsTable } from "@/features/follow-ups/components/follow-ups-table";
import { withScheduleStates } from "@/features/follow-ups/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

// Wednesday 30 September 2026, 10:00 in Johannesburg.
const NOW = "2026-09-30T08:00:00Z";
const ME = "user-me";
const THEM = "user-them";

function followUp(overrides: Partial<FollowUpListItem> = {}): FollowUpListItem {
  return {
    id: "fu-1",
    reference: "FUP-0001",
    clientId: "client-1",
    clientName: "Blackridge Hotels",
    contact: {
      id: "contact-1",
      fullName: "James Mitchell",
      email: "james@example.com",
      phone: "0761234567",
      role: "Head of Marketing",
    },
    related: { id: "project-1", label: "Autumn Resort Campaign", kind: "Project" },
    followUpType: "Quote Follow-up",
    customType: "",
    displayType: "Quote Follow-up",
    title: "Confirm client approval",
    overview: "The client has received the quote.",
    notes: "",
    dueDate: "2026-09-30",
    dueTime: "11:00",
    priority: "High",
    contactMethods: ["Email", "Phone"],
    status: "Open",
    scheduleState: "Today",
    outcome: "",
    cancellationReason: "",
    completedAt: null,
    cancelledAt: null,
    owner: { id: ME, name: "Neo Matime", email: "neo@example.com" },
    seriesId: null,
    occurrenceNumber: 1,
    successorId: null,
    version: 1,
    createdAt: "2026-09-20T08:00:00Z",
    updatedAt: "2026-09-20T08:00:00Z",
    checklist: [
      {
        id: "item-1",
        label: "Review quote summary",
        sortOrder: 0,
        isCompleted: true,
        completedAt: "2026-09-29T08:00:00Z",
        version: 1,
      },
      {
        id: "item-2",
        label: "Confirm scope",
        sortOrder: 1,
        isCompleted: false,
        completedAt: null,
        version: 1,
      },
    ],
    ...overrides,
  };
}

const ROWS: FollowUpListItem[] = [
  followUp(), // Today, High, Project, mine
  followUp({
    id: "fu-2",
    reference: "FUP-0002",
    clientId: "client-2",
    clientName: "Lumen Partners",
    contact: null,
    related: { id: "enquiry-2", label: "Global Brand Film", kind: "Enquiry" },
    followUpType: "Proposal Review",
    displayType: "Proposal Review",
    title: "Check internal sign-off",
    dueDate: "2026-09-29",
    dueTime: "16:00",
    priority: "Medium",
    contactMethods: ["WhatsApp"],
    scheduleState: "Overdue",
    owner: { id: THEM, name: "Tara Reed", email: "tara@example.com" },
    createdAt: "2026-09-21T08:00:00Z",
  }),
  followUp({
    id: "fu-3",
    reference: "FUP-0003",
    clientId: "client-3",
    clientName: "Seacliff Originals",
    related: null,
    followUpType: "Deposit Reminder",
    displayType: "Deposit Reminder",
    title: "Request payment update",
    dueDate: "2026-10-08",
    dueTime: "",
    priority: "Low",
    contactMethods: ["Email"],
    scheduleState: "Upcoming",
    createdAt: "2026-09-22T08:00:00Z",
  }),
  followUp({
    id: "fu-4",
    reference: "FUP-0004",
    clientId: "client-1",
    clientName: "Blackridge Hotels",
    related: null,
    followUpType: "Other",
    customType: "Site visit",
    displayType: "Site visit",
    title: "Walk the venue",
    dueDate: "2026-09-25",
    dueTime: "",
    priority: "Low",
    status: "Completed",
    scheduleState: "Completed",
    completedAt: "2026-09-26T09:00:00Z",
    outcome: "Venue confirmed.",
    createdAt: "2026-09-10T08:00:00Z",
  }),
  followUp({
    id: "fu-5",
    reference: "FUP-0005",
    clientId: "client-3",
    clientName: "Seacliff Originals",
    related: null,
    followUpType: "Approval",
    displayType: "Approval",
    title: "Get sign-off on the storyboard",
    dueDate: "2026-10-02",
    dueTime: "",
    priority: "High",
    status: "Cancelled",
    scheduleState: "Cancelled",
    cancelledAt: "2026-09-28T09:00:00Z",
    cancellationReason: "Client withdrew.",
    createdAt: "2026-09-23T08:00:00Z",
  }),
];

function renderTable(rows: FollowUpListItem[] = ROWS, now = NOW) {
  return render(<FollowUpsTable rows={rows} now={now} currentUserId={ME} />);
}

const table = () => screen.getByRole("table");
const list = () => screen.getByRole("list", { name: "Follow-ups" });
const tableRows = () => within(table()).getAllByRole("row").slice(1);
const references = () =>
  tableRows().map((row) => /FUP-\d{4}/.exec(row.textContent ?? "")?.[0] ?? "(none)");
const rowFor = (reference: string) => {
  const row = tableRows().find((candidate) => candidate.textContent?.includes(reference));
  if (!row) throw new Error(`No table row for ${reference}`);
  return within(row);
};

afterEach(() => {
  vi.useRealTimers();
});

describe("FollowUpsTable tabs", () => {
  it("shows every approved tab with its count", () => {
    renderTable();
    expect(screen.getByRole("tab", { name: "All (5)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Due Today (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overdue (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Upcoming (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Completed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cancelled (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All (5)" })).toHaveAttribute("aria-selected", "true");
  });

  it.each([
    ["All (5)", ["FUP-0004", "FUP-0002", "FUP-0001", "FUP-0005", "FUP-0003"]],
    ["Due Today (1)", ["FUP-0001"]],
    ["Overdue (1)", ["FUP-0002"]],
    ["Upcoming (1)", ["FUP-0003"]],
    ["Completed (1)", ["FUP-0004"]],
    ["Cancelled (1)", ["FUP-0005"]],
  ])("filters rows on the %s tab", (tab, expected) => {
    renderTable();
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(references()).toEqual(expected);
  });

  it("keeps tab counts as totals while search and filters narrow the rows", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "High" } });
    expect(screen.getByRole("tab", { name: "All (5)" })).toBeInTheDocument();
    expect(references()).toEqual(["FUP-0001", "FUP-0005"]);
    expect(screen.getByText("Showing 2 of 5 follow-ups")).toBeInTheDocument();
  });
});

describe("FollowUpsTable search", () => {
  const search = (value: string) =>
    fireEvent.change(screen.getByPlaceholderText("Search follow-ups..."), {
      target: { value },
    });

  it("has a real label for the search box", () => {
    renderTable();
    expect(screen.getByLabelText("Search follow-ups")).toBe(
      screen.getByPlaceholderText("Search follow-ups..."),
    );
  });

  it.each([
    ["reference", "fup-0002", ["FUP-0002"]],
    ["client", "lumen", ["FUP-0002"]],
    ["title or next action", "payment update", ["FUP-0003"]],
    ["type", "deposit reminder", ["FUP-0003"]],
    ["custom type", "site visit", ["FUP-0004"]],
    ["related record title", "autumn resort", ["FUP-0001"]],
  ])("searches by %s", (_name, query, expected) => {
    renderTable();
    search(query);
    expect(references()).toEqual(expected);
  });

  it("combines search with the active tab", () => {
    renderTable();
    fireEvent.click(screen.getByRole("tab", { name: "Overdue (1)" }));
    search("blackridge");
    expect(screen.getByText("No follow-ups match these filters.")).toBeInTheDocument();
  });
});

describe("FollowUpsTable filters", () => {
  it("filters by client, listing each client once", () => {
    renderTable();
    const client = screen.getByLabelText("Client");
    expect(
      within(client)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All clients", "Blackridge Hotels", "Lumen Partners", "Seacliff Originals"]);
    fireEvent.change(client, { target: { value: "client-3" } });
    expect(references()).toEqual(["FUP-0005", "FUP-0003"]);
  });

  it("filters by type", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "Proposal Review" } });
    expect(references()).toEqual(["FUP-0002"]);
  });

  it("filters by priority", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "Low" } });
    expect(references()).toEqual(["FUP-0004", "FUP-0003"]);
  });

  it("filters by contact method", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Contact method"), { target: { value: "WhatsApp" } });
    expect(references()).toEqual(["FUP-0002"]);
    fireEvent.change(screen.getByLabelText("Contact method"), { target: { value: "Email" } });
    expect(references()).toEqual(["FUP-0004", "FUP-0001", "FUP-0005", "FUP-0003"]);
  });

  it("scopes to the current user's follow-ups with Mine and shows everyone with All", () => {
    renderTable();
    const scope = screen.getByLabelText("Owner scope");
    expect(
      within(scope)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Owner: All", "Owner: Mine"]);
    expect(scope).toHaveValue("all");
    expect(references()).toContain("FUP-0002");

    fireEvent.change(scope, { target: { value: "mine" } });
    expect(references()).toEqual(["FUP-0004", "FUP-0001", "FUP-0005", "FUP-0003"]);

    fireEvent.change(scope, { target: { value: "all" } });
    expect(references()).toContain("FUP-0002");
  });

  it("matches nothing for Mine when the current user owns no follow-ups", () => {
    render(<FollowUpsTable rows={ROWS} now={NOW} currentUserId="somebody-else" />);
    fireEvent.change(screen.getByLabelText("Owner scope"), { target: { value: "mine" } });
    expect(screen.getByText("No follow-ups match these filters.")).toBeInTheDocument();
  });

  it("stacks filters together", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "client-3" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "High" } });
    expect(references()).toEqual(["FUP-0005"]);
  });
});

describe("FollowUpsTable sorting", () => {
  it("defaults to due date, soonest first", () => {
    renderTable();
    expect(screen.getByLabelText("Sort")).toHaveValue("due-soonest");
    expect(references()).toEqual(["FUP-0004", "FUP-0002", "FUP-0001", "FUP-0005", "FUP-0003"]);
  });

  it.each([
    ["priority", ["FUP-0001", "FUP-0005", "FUP-0002", "FUP-0004", "FUP-0003"]],
    ["newest", ["FUP-0005", "FUP-0003", "FUP-0002", "FUP-0001", "FUP-0004"]],
    ["oldest", ["FUP-0004", "FUP-0001", "FUP-0002", "FUP-0003", "FUP-0005"]],
  ])("sorts by %s", (value, expected) => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value } });
    expect(references()).toEqual(expected);
  });

  it("offers due date, priority, newest and oldest", () => {
    renderTable();
    expect(
      within(screen.getByLabelText("Sort"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Sort: Due date", "Sort: Priority", "Sort: Newest", "Sort: Oldest"]);
  });
});

describe("FollowUpsTable selection and preview", () => {
  it("reveals only the checked follow-up's preview", () => {
    renderTable();
    expect(screen.queryByRole("region", { name: /preview/ })).not.toBeInTheDocument();

    fireEvent.click(within(table()).getByRole("checkbox", { name: "Preview FUP-0001" }));
    const preview = screen.getByRole("region", { name: "FUP-0001 preview" });
    expect(
      within(preview).getByRole("heading", { name: "Confirm client approval" }),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Quote Follow-up")).toBeInTheDocument();
    expect(within(preview).getByText("Wed, 30 Sep 2026, 11:00")).toBeInTheDocument();
    expect(within(preview).getByText("Email, Phone")).toBeInTheDocument();
    expect(within(preview).getByText("Neo Matime")).toBeInTheDocument();
    expect(within(preview).getByText("The client has received the quote.")).toBeInTheDocument();
    expect(within(preview).getByText("1/2")).toBeInTheDocument();
    expect(within(preview).getByText(/Review quote summary/)).toBeInTheDocument();

    fireEvent.click(within(table()).getByRole("checkbox", { name: "Preview FUP-0002" }));
    expect(screen.queryByRole("region", { name: "FUP-0001 preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "FUP-0002 preview" })).toBeInTheDocument();

    fireEvent.click(within(table()).getByRole("checkbox", { name: "Preview FUP-0002" }));
    expect(screen.queryByRole("region", { name: /preview/ })).not.toBeInTheDocument();
  });

  it("shows the outcome of a completed follow-up and when it was completed", () => {
    renderTable();
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Preview FUP-0004" }));
    const preview = screen.getByRole("region", { name: "FUP-0004 preview" });
    expect(within(preview).getByText("Venue confirmed.")).toBeInTheDocument();
    expect(within(preview).getByText("Sat, 26 Sep 2026")).toBeInTheDocument();
  });

  it("shows the cancellation reason of a cancelled follow-up", () => {
    renderTable();
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Preview FUP-0005" }));
    expect(
      within(screen.getByRole("region", { name: "FUP-0005 preview" })).getByText(
        "Client withdrew.",
      ),
    ).toBeInTheDocument();
  });

  it("selects from the stacked list too, and the two controls stay in step", () => {
    renderTable();
    fireEvent.click(within(list()).getByRole("checkbox", { name: "Preview FUP-0003" }));
    expect(screen.getByRole("region", { name: "FUP-0003 preview" })).toBeInTheDocument();
    expect(within(table()).getByRole("checkbox", { name: "Preview FUP-0003" })).toBeChecked();
  });

  it("drops the preview when its row is filtered out", () => {
    renderTable();
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Preview FUP-0001" }));
    fireEvent.click(screen.getByRole("tab", { name: "Overdue (1)" }));
    expect(screen.queryByRole("region", { name: /preview/ })).not.toBeInTheDocument();
  });
});

describe("FollowUpsTable navigation", () => {
  it("links the follow-up, client and related record with real anchors", () => {
    renderTable();
    const row = rowFor("FUP-0002"); // Lumen's follow-up relates to an enquiry.
    expect(row.getByRole("link", { name: "FUP-0002" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-2",
    );
    expect(row.getByRole("link", { name: "Check internal sign-off" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-2",
    );
    expect(row.getByRole("link", { name: "Lumen Partners" })).toHaveAttribute(
      "href",
      "/ops/clients/client-2",
    );
    expect(row.getByRole("link", { name: "Global Brand Film" })).toHaveAttribute(
      "href",
      "/ops/enquiries/enquiry-2",
    );
  });

  it("links a related project to the project route", () => {
    renderTable();
    expect(
      rowFor("FUP-0001").getByRole("link", { name: "Autumn Resort Campaign" }),
    ).toHaveAttribute("href", "/ops/projects/project-1");
  });

  it("says so when a follow-up has no related record", () => {
    renderTable([ROWS[2]!]);
    expect(within(table()).getByText("No related item")).toBeInTheDocument();
  });

  it("does not make rows clickable or nest controls inside links", () => {
    const { container } = renderTable();
    for (const row of within(table()).getAllByRole("row")) {
      expect(row).not.toHaveAttribute("onclick");
      expect(row).not.toHaveAttribute("tabindex");
      expect(row).not.toHaveAttribute("role", "link");
      expect(row.className).not.toContain("cursor-pointer");
    }
    expect(container.querySelector("a button, a input, a select, button a")).toBeNull();
    // The checkbox is the only way to open a preview.
    fireEvent.click(tableRows()[0]!);
    expect(screen.queryByRole("region", { name: /preview/ })).not.toBeInTheDocument();
  });
});

describe("FollowUpsTable states", () => {
  it("says no follow-ups match inside the table area, without hiding the controls", () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText("Search follow-ups..."), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText("No follow-ups match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Follow-up views" })).toBeInTheDocument();
    expect(screen.getByLabelText("Client")).toBeInTheDocument();
  });

  it("recovers once the search is cleared", () => {
    renderTable();
    const input = screen.getByPlaceholderText("Search follow-ups...");
    fireEvent.change(input, { target: { value: "zzzz" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(tableRows()).toHaveLength(5);
  });
});

describe("FollowUpsTable badges", () => {
  it("states scheduling status and priority in text", () => {
    renderTable();
    expect(rowFor("FUP-0002").getByText("Overdue")).toBeInTheDocument();
    expect(rowFor("FUP-0001").getByText("Due Today")).toBeInTheDocument();
    expect(rowFor("FUP-0001").getByText("High")).toBeInTheDocument();
    expect(rowFor("FUP-0002").getByText("Medium")).toBeInTheDocument();
    expect(rowFor("FUP-0003").getByText("Upcoming")).toBeInTheDocument();
    expect(rowFor("FUP-0003").getByText("Low")).toBeInTheDocument();
    expect(rowFor("FUP-0004").getByText("Completed")).toBeInTheDocument();
    expect(rowFor("FUP-0005").getByText("Cancelled")).toBeInTheDocument();
  });
});

describe("FollowUpsTable responsive contract", () => {
  it("never introduces horizontal scrolling anywhere", () => {
    const { container } = renderTable();
    expect(container.innerHTML).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(container.innerHTML).not.toMatch(/overflow-auto|overflow-scroll/);
    expect(container.innerHTML).not.toMatch(/min-w-\[/);
  });

  it("fits its container: full width, fixed layout, hidden below @2xl", () => {
    renderTable();
    expect(table()).toHaveClass("w-full", "table-fixed", "hidden", "@2xl:table");
    expect(table().parentElement).toHaveClass("@container");
  });

  it("swaps to a compact stacked list below @2xl", () => {
    renderTable();
    expect(list()).toHaveClass("@2xl:hidden");
    expect(list().parentElement).toBe(table().parentElement);
    expect(within(list()).getAllByRole("listitem")).toHaveLength(5);
  });

  it("keeps the essential columns always and drops secondary ones progressively", () => {
    renderTable();
    const headers = within(table()).getAllByRole("columnheader");
    const header = (name: string) =>
      headers.find((cell) => cell.textContent?.trim() === name) as HTMLElement;

    for (const essential of ["Client / Related", "Due", "Status", "Next Action"]) {
      expect(header(essential).className).not.toMatch(/(^|\s)hidden(\s|$)/);
    }
    for (const mid of ["Reference", "Priority"]) {
      expect(header(mid)).toHaveClass("hidden", "@4xl:table-cell");
    }
    for (const wide of ["Type", "Owner"]) {
      expect(header(wide)).toHaveClass("hidden", "@5xl:table-cell");
    }
  });

  it("applies the same visibility to every body cell as to its header", () => {
    renderTable();
    const headers = within(table()).getAllByRole("columnheader");
    // The preview checkbox column header plus eight data columns line up with each row's cells.
    for (const row of tableRows()) {
      const cells = within(row).getAllByRole("cell");
      expect(cells).toHaveLength(headers.length);
      cells.forEach((cell, index) => {
        const hiddenCell = cell.className.match(/@\dxl:table-cell/)?.[0];
        const hiddenHeader = headers[index]!.className.match(/@\dxl:table-cell/)?.[0];
        expect(hiddenCell).toBe(hiddenHeader);
      });
    }
  });

  it("wraps the tab strip and filter row rather than scrolling them", () => {
    renderTable();
    const tablist = screen.getByRole("tablist", { name: "Follow-up views" });
    expect(tablist).toHaveClass("flex-wrap");
    expect(tablist.className).not.toContain("overflow");
    const controls = screen.getByLabelText("Client").closest("div")!;
    expect(controls).toHaveClass("grid", "sm:flex", "sm:flex-wrap");
    expect(controls.className).not.toContain("overflow");
  });

  it("labels every control with a real label element", () => {
    renderTable();
    for (const name of ["Client", "Type", "Priority", "Contact method", "Owner scope", "Sort"]) {
      const control = screen.getByLabelText(name);
      expect(control.tagName).toBe("SELECT");
      expect(control.closest("label")).not.toBeNull();
    }
  });
});

describe("FollowUpsTable dates", () => {
  it("labels due dates relative to the server-provided Johannesburg day", () => {
    renderTable();
    expect(rowFor("FUP-0001").getByText("Today, 11:00")).toBeInTheDocument();
    expect(rowFor("FUP-0002").getByText("Yesterday, 16:00")).toBeInTheDocument();
    expect(rowFor("FUP-0003").getByText("Thu, 8 Oct")).toBeInTheDocument();
    expect(rowFor("FUP-0004").getByText("Fri, 25 Sep")).toBeInTheDocument();
  });

  it("uses the Johannesburg calendar day even when UTC is still on the previous day", () => {
    // 22:30 UTC on 30 September is 00:30 on 1 October in Johannesburg.
    const now = "2026-09-30T22:30:00Z";
    renderTable(withScheduleStates(ROWS, new Date(now)), now);
    expect(rowFor("FUP-0001").getByText("Yesterday, 11:00")).toBeInTheDocument();
    expect(rowFor("FUP-0005").getByText("Tomorrow")).toBeInTheDocument();
    expect(rowFor("FUP-0003").getByText("Thu, 8 Oct")).toBeInTheDocument();
    // The follow-up due on the 30th is now overdue rather than "due today".
    expect(rowFor("FUP-0001").getByText("Overdue")).toBeInTheDocument();
  });

  it("never reads the browser clock while rendering", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-05-01T12:00:00Z"));
    renderTable();
    expect(rowFor("FUP-0001").getByText("Today, 11:00")).toBeInTheDocument();
    expect(rowFor("FUP-0003").getByText("Thu, 8 Oct")).toBeInTheDocument();
  });
});
