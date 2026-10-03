import { describe, expect, it } from "vitest";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";
import {
  buildRelatedFollowUps,
  relatedAddAvailability,
} from "@/features/follow-ups/related-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

// Wednesday 30 September 2026, 10:00 in Johannesburg.
const NOW = new Date("2026-09-30T08:00:00Z");

function row(overrides: Partial<FollowUpListItem>) {
  return followUpDetail(overrides);
}

describe("buildRelatedFollowUps", () => {
  it("re-evaluates scheduling states against the one server `now`", () => {
    // Shaped as "Upcoming" earlier, but due this morning it is Overdue at NOW.
    const stale = row({
      id: "stale",
      scheduleState: "Upcoming",
      dueDate: "2026-09-30",
      dueTime: "09:00",
    });
    const result = buildRelatedFollowUps([stale], NOW);
    expect(result.actionable[0]?.scheduleState).toBe("Overdue");
    expect(result.now).toBe("2026-09-30T08:00:00.000Z");
  });

  it("splits actionable, completed and cancelled rows and counts everything", () => {
    const result = buildRelatedFollowUps(
      [
        row({ id: "up", dueDate: "2026-10-10", dueTime: "" }),
        row({ id: "over", dueDate: "2026-09-01", dueTime: "" }),
        row({ id: "today", dueDate: "2026-09-30", dueTime: "15:00" }),
        row({ id: "old-done", status: "Completed", completedAt: "2026-09-01T08:00:00Z" }),
        row({ id: "new-done", status: "Completed", completedAt: "2026-09-29T08:00:00Z" }),
        row({ id: "cancelled", status: "Cancelled", cancelledAt: "2026-09-02T08:00:00Z" }),
      ],
      NOW,
    );
    expect(result.actionable.map((r) => r.id)).toEqual(["over", "today", "up"]);
    expect(result.completed.map((r) => r.id)).toEqual(["new-done", "old-done"]);
    expect(result.cancelled.map((r) => r.id)).toEqual(["cancelled"]);
    expect(result.total).toBe(6);
  });

  it("handles no follow-ups", () => {
    expect(buildRelatedFollowUps([], NOW)).toEqual({
      now: "2026-09-30T08:00:00.000Z",
      actionable: [],
      completed: [],
      cancelled: [],
      total: 0,
    });
  });
});

describe("relatedAddAvailability", () => {
  const live = { archived: false, clientId: "client-1", clientArchived: false };

  it("allows adding to a live parent with a live client", () => {
    expect(relatedAddAvailability("project", live)).toEqual({ canAdd: true });
  });

  it.each(["client", "enquiry", "project"] as const)("blocks an archived %s", (subject) => {
    const result = relatedAddAvailability(subject, { ...live, archived: true });
    expect(result.canAdd).toBe(false);
    if (!result.canAdd) expect(result.reason).toContain(`This ${subject} is archived`);
  });

  it("blocks a parent with no client and says why", () => {
    const result = relatedAddAvailability("enquiry", { ...live, clientId: null });
    expect(result.canAdd).toBe(false);
    if (!result.canAdd) expect(result.reason).toContain("isn't linked to one");
  });

  it("blocks a live enquiry or project whose client is archived", () => {
    for (const subject of ["enquiry", "project"] as const) {
      const result = relatedAddAvailability(subject, { ...live, clientArchived: true });
      expect(result.canAdd).toBe(false);
      if (!result.canAdd) expect(result.reason).toContain("This client is archived");
    }
  });
});
