import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUpsPage from "@/app/(app)/ops/follow-ups/page";
import type { FollowUpListItem } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/follow-ups/fetch-follow-ups", () => ({ fetchFollowUps: mocks.fetch }));
vi.mock("@/features/follow-ups/components/follow-ups-table", () => ({
  FollowUpsTable: (props: { rows: FollowUpListItem[]; now: string; currentUserId: string }) => (
    <output data-testid="table">
      {JSON.stringify({
        states: props.rows.map((row) => row.scheduleState),
        now: props.now,
        currentUserId: props.currentUserId,
      })}
    </output>
  ),
}));

// Wednesday 30 September 2026, 10:00 in Johannesburg.
const NOW = new Date("2026-09-30T08:00:00Z");

function row(overrides: Partial<FollowUpListItem> = {}): FollowUpListItem {
  return {
    id: "fu",
    reference: "FUP-0001",
    clientId: "client",
    clientName: "Blackridge",
    contact: null,
    related: null,
    followUpType: "Client Check-in",
    customType: "",
    displayType: "Client Check-in",
    title: "Check in",
    overview: "",
    notes: "",
    dueDate: "2026-09-30",
    dueTime: "",
    priority: "Medium",
    contactMethods: [],
    status: "Open",
    scheduleState: "Today",
    outcome: "",
    cancellationReason: "",
    completedAt: null,
    cancelledAt: null,
    owner: { id: "admin", name: "Neo", email: "neo@example.com" },
    seriesId: null,
    occurrenceNumber: 1,
    successorId: null,
    version: 1,
    createdAt: "2026-09-20T08:00:00Z",
    updatedAt: "2026-09-20T08:00:00Z",
    checklist: [],
    ...overrides,
  };
}

const stat = (label: string) =>
  screen.getByText(label).parentElement!.querySelector("div")!.textContent;
const rendered = () => JSON.parse(screen.getByTestId("table").textContent!);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mocks.auth.mockResolvedValue({ id: "admin" });
});
afterEach(() => vi.useRealTimers());

describe("FollowUpsPage", () => {
  it("authenticates before fetching data and renders the unavailable state", async () => {
    const order: string[] = [];
    mocks.auth.mockImplementation(async () => {
      order.push("auth");
      return { id: "admin" };
    });
    mocks.fetch.mockImplementation(async () => {
      order.push("fetch");
      return null;
    });
    render(await FollowUpsPage());
    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByText("Follow-ups are temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No follow-ups yet")).not.toBeInTheDocument();
    // The create action stays available even when the list cannot load.
    expect(screen.getByRole("link", { name: "New Follow-up" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/new",
    );
  });

  it("renders a friendly empty state with a link to create the first follow-up", async () => {
    mocks.fetch.mockResolvedValue([]);
    render(await FollowUpsPage());
    expect(screen.getByText("No follow-ups yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create the first follow-up" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/new",
    );
    expect(screen.queryByText("Follow-ups are temporarily unavailable")).not.toBeInTheDocument();
    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
  });

  it("renders the header with a real New Follow-up link", async () => {
    mocks.fetch.mockResolvedValue([row()]);
    const { container } = render(await FollowUpsPage());
    expect(screen.getByRole("heading", { level: 1, name: "Follow-ups" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "New Follow-up" });
    expect(link).toHaveAttribute("href", "/ops/follow-ups/new");
    expect(link.tagName).toBe("A");
    expect(container.querySelector("a button, button a")).toBeNull();
  });

  it("renders four factual metric cards from the shaped rows", async () => {
    mocks.fetch.mockResolvedValue([
      row({ id: "1", dueDate: "2026-09-30", dueTime: "" }), // due today
      row({ id: "2", dueDate: "2026-09-29" }), // overdue, earlier this week: Overdue only, not Due This Week
      row({ id: "3", dueDate: "2026-09-27" }), // overdue, last week
      row({ id: "4", dueDate: "2026-10-04" }), // upcoming, Sunday of this week
      row({ id: "5", dueDate: "2026-10-05" }), // upcoming, next week
      row({
        id: "6",
        status: "Completed",
        completedAt: "2026-09-28T06:00:00Z", // Monday
      }),
      row({
        id: "7",
        status: "Completed",
        completedAt: "2026-09-20T06:00:00Z", // the week before
      }),
      row({ id: "8", status: "Cancelled", dueDate: "2026-09-30" }),
    ]);
    render(await FollowUpsPage());
    expect(stat("Due Today")).toBe("1");
    expect(stat("Overdue")).toBe("2");
    expect(stat("Due This Week")).toBe("2");
    expect(stat("Completed This Week")).toBe("1");
    // Plain counts: no trend deltas.
    expect(screen.queryByText(/yesterday|high priority|across/i)).not.toBeInTheDocument();
  });

  it("re-evaluates scheduling states against the same instant it hands the table", async () => {
    mocks.fetch.mockResolvedValue([
      // Shaped a moment earlier as "Today", but already past in Johannesburg.
      row({ id: "1", dueDate: "2026-09-30", dueTime: "09:00", scheduleState: "Today" }),
      row({ id: "2", dueDate: "2026-10-01", scheduleState: "Today" }),
    ]);
    render(await FollowUpsPage());
    expect(rendered()).toEqual({
      states: ["Overdue", "Upcoming"],
      now: NOW.toISOString(),
      currentUserId: "admin",
    });
    expect(stat("Overdue")).toBe("1");
  });

  it("passes the signed-in user to the table for Mine scope", async () => {
    mocks.auth.mockResolvedValue({ id: "user-42" });
    mocks.fetch.mockResolvedValue([row()]);
    render(await FollowUpsPage());
    expect(rendered().currentUserId).toBe("user-42");
  });
});
