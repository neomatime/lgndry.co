import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatDueFull,
  formatDueLabel,
  formatJohannesburgDay,
} from "@/features/follow-ups/due-label";

// Wednesday 30 September 2026, 10:00 in Johannesburg.
const now = new Date("2026-09-30T08:00:00Z");

describe("follow-up date labels", () => {
  it("names today, tomorrow and yesterday against the Johannesburg calendar day", () => {
    expect(formatDueLabel("2026-09-30", "11:00", now)).toBe("Today, 11:00");
    expect(formatDueLabel("2026-10-01", "10:00:00", now)).toBe("Tomorrow, 10:00");
    expect(formatDueLabel("2026-09-29", "16:00", now)).toBe("Yesterday, 16:00");
    expect(formatDueLabel("2026-09-30", "", now)).toBe("Today");
  });

  it("treats 22:30 UTC as the next day in Johannesburg, whatever the runtime zone is", () => {
    const lateEvening = new Date("2026-09-30T22:30:00Z");
    expect(formatDueLabel("2026-10-01", "", lateEvening)).toBe("Today");
    expect(formatDueLabel("2026-09-30", "", lateEvening)).toBe("Yesterday");
  });

  it("uses a short weekday and date otherwise, adding the year only when it differs", () => {
    expect(formatDueLabel("2026-10-08", "", now)).toBe("Thu, 8 Oct");
    expect(formatDueLabel("2027-01-04", "09:30", now)).toBe("Mon, 4 Jan 2027, 09:30");
  });

  it("formats full dates from the calendar parts without zone conversion", () => {
    expect(formatCalendarDate("2026-09-30")).toBe("Wed, 30 Sep 2026");
    expect(formatDueFull("2026-12-31", "")).toBe("Thu, 31 Dec 2026");
    expect(formatDueFull("2026-12-31", "23:15:00")).toBe("Thu, 31 Dec 2026, 23:15");
  });

  it("converts timestamps to their Johannesburg day", () => {
    expect(formatJohannesburgDay("2026-09-29T22:30:00Z")).toBe("Wed, 30 Sep 2026");
    expect(formatJohannesburgDay("2026-09-29T21:30:00Z")).toBe("Tue, 29 Sep 2026");
    expect(formatJohannesburgDay("not a date")).toBe("");
  });
});
