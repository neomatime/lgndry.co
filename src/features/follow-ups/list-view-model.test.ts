import { describe, expect, it } from "vitest";
import {
  addDays,
  filterFollowUps,
  getScheduleState,
  johannesburgDate,
  johannesburgWeek,
  sortFollowUps,
  summarizeFollowUps,
  withScheduleStates,
} from "@/features/follow-ups/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

const base = {
  id: "1",
  reference: "FUP-00001",
  clientId: "c",
  clientName: "Acme",
  contact: null,
  related: null,
  followUpType: "Client Check-in" as const,
  customType: "",
  displayType: "Client Check-in",
  title: "Call client",
  overview: "",
  notes: "",
  dueDate: "2026-09-30",
  dueTime: "",
  priority: "Medium" as const,
  contactMethods: ["Phone" as const],
  status: "Open" as const,
  scheduleState: "Today" as const,
  outcome: "",
  cancellationReason: "",
  completedAt: null,
  cancelledAt: null,
  owner: { id: "u", name: "Neo", email: "neo@example.com" },
  seriesId: null,
  occurrenceNumber: 1,
  successorId: null,
  version: 1,
  createdAt: "2026-09-29T08:00:00Z",
  updatedAt: "2026-09-29T08:00:00Z",
  checklist: [],
} satisfies FollowUpListItem;

describe("follow-up list view model", () => {
  it("uses Johannesburg date and time for due state", () => {
    const now = new Date("2026-09-30T08:00:00Z");
    expect(getScheduleState("Open", "2026-09-30", "09:00", now)).toBe("Overdue");
    expect(getScheduleState("Open", "2026-09-30", "", now)).toBe("Today");
    expect(getScheduleState("Open", "2026-10-01", "", now)).toBe("Upcoming");
  });

  it("summarizes, filters and sorts rows", () => {
    const rows: FollowUpListItem[] = [
      base,
      {
        ...base,
        id: "2",
        title: "Send proposal",
        scheduleState: "Overdue",
        priority: "High",
        dueDate: "2026-09-29",
      },
    ];
    expect(summarizeFollowUps(rows, new Date("2026-09-30T06:00:00Z"))).toEqual({
      overdue: 1,
      dueToday: 1,
      upcoming: 0,
      completed: 0,
      dueThisWeek: 2,
      completedThisWeek: 0,
    });
    expect(filterFollowUps(rows, { view: "Overdue", search: "proposal" })).toHaveLength(1);
    expect(sortFollowUps(rows, "priority")[0]?.id).toBe("2");
  });

  it("derives the Johannesburg date and its Monday-Sunday week", () => {
    // 22:30Z on the 29th is already 00:30 on the 30th in Johannesburg (UTC+2).
    expect(johannesburgDate(new Date("2026-09-29T22:30:00Z"))).toBe("2026-09-30");
    expect(johannesburgWeek(new Date("2026-09-30T08:00:00Z"))).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
    // A Sunday belongs to the week that started the previous Monday.
    expect(johannesburgWeek(new Date("2026-10-04T10:00:00Z"))).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
    // Sunday 22:30Z is Monday 00:30 in Johannesburg, so the next week has begun.
    expect(johannesburgWeek(new Date("2026-10-04T22:30:00Z")).start).toBe("2026-10-05");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts due-this-week and completed-this-week using Johannesburg dates", () => {
    const now = new Date("2026-09-30T08:00:00Z"); // Wednesday
    const rows: FollowUpListItem[] = [
      { ...base, id: "mon", dueDate: "2026-09-28", scheduleState: "Overdue" },
      { ...base, id: "today", dueDate: "2026-09-30", scheduleState: "Today" },
      { ...base, id: "sun", dueDate: "2026-10-04", scheduleState: "Upcoming" },
      { ...base, id: "next-mon", dueDate: "2026-10-05", scheduleState: "Upcoming" },
      { ...base, id: "last-sun", dueDate: "2026-09-27", scheduleState: "Overdue" },
      {
        ...base,
        id: "cancelled",
        dueDate: "2026-09-30",
        status: "Cancelled",
        scheduleState: "Cancelled",
      },
      {
        ...base,
        id: "done-this-week",
        dueDate: "2026-09-20",
        status: "Completed",
        scheduleState: "Completed",
        // 22:30Z on Sunday 27th is Monday 28th in Johannesburg: inside this week.
        completedAt: "2026-09-27T22:30:00Z",
      },
      {
        ...base,
        id: "done-last-week",
        status: "Completed",
        scheduleState: "Completed",
        completedAt: "2026-09-27T21:30:00Z",
      },
      {
        ...base,
        id: "done-no-timestamp",
        status: "Completed",
        scheduleState: "Completed",
        completedAt: null,
      },
    ];
    expect(summarizeFollowUps(rows, now)).toEqual({
      overdue: 2,
      dueToday: 1,
      upcoming: 2,
      completed: 3,
      dueThisWeek: 3,
      completedThisWeek: 1,
    });
  });

  it("re-evaluates scheduling states against one now", () => {
    const rows: FollowUpListItem[] = [
      { ...base, id: "a", dueDate: "2026-10-01", scheduleState: "Today" },
      { ...base, id: "b", status: "Completed", scheduleState: "Completed" },
    ];
    const next = withScheduleStates(rows, new Date("2026-09-30T08:00:00Z"));
    expect(next.map((row) => row.scheduleState)).toEqual(["Upcoming", "Completed"]);
    expect(rows[0]?.scheduleState).toBe("Today");
  });

  it("filters by client and contact method alongside the existing filters", () => {
    const rows: FollowUpListItem[] = [
      base,
      { ...base, id: "2", clientId: "other", contactMethods: ["Email", "WhatsApp"] },
    ];
    const ids = (filters: Parameters<typeof filterFollowUps>[1]) =>
      filterFollowUps(rows, filters).map((row) => row.id);
    expect(ids({ view: "All", search: "", clientId: "other" })).toEqual(["2"]);
    expect(ids({ view: "All", search: "", contactMethod: "WhatsApp" })).toEqual(["2"]);
    expect(ids({ view: "All", search: "", contactMethod: "Phone" })).toEqual(["1"]);
    expect(ids({ view: "All", search: "", ownerId: "someone-else" })).toEqual([]);
  });

  it("sorts by due date, newest and oldest", () => {
    const rows: FollowUpListItem[] = [
      { ...base, id: "a", dueDate: "2026-10-02", createdAt: "2026-09-01T00:00:00Z" },
      {
        ...base,
        id: "b",
        dueDate: "2026-10-01",
        dueTime: "09:00",
        createdAt: "2026-09-03T00:00:00Z",
      },
      { ...base, id: "c", dueDate: "2026-10-01", createdAt: "2026-09-02T00:00:00Z" },
    ];
    const order = (sort: Parameters<typeof sortFollowUps>[1]) =>
      sortFollowUps(rows, sort).map((row) => row.id);
    expect(order("due-soonest")).toEqual(["b", "c", "a"]);
    expect(order("newest")).toEqual(["b", "c", "a"]);
    expect(order("oldest")).toEqual(["a", "c", "b"]);
  });
});
