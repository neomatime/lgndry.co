import { describe, expect, it } from "vitest";
import {
  filterFollowUps,
  getScheduleState,
  sortFollowUps,
  summarizeFollowUps,
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
    expect(summarizeFollowUps(rows)).toEqual({
      overdue: 1,
      dueToday: 1,
      upcoming: 0,
      completed: 0,
    });
    expect(filterFollowUps(rows, { view: "Overdue", search: "proposal" })).toHaveLength(1);
    expect(sortFollowUps(rows, "priority")[0]?.id).toBe("2");
  });
});
