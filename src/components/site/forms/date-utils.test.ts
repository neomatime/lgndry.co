import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildCells,
  formatDisplay,
  parseISO,
  toISO,
} from "@/components/site/forms/date-utils";

describe("toISO / parseISO / formatDisplay", () => {
  it("round-trips a local calendar day", () => {
    const date = new Date(2026, 9, 5); // 5 Oct 2026
    expect(toISO(date)).toBe("2026-10-05");
    expect(parseISO("2026-10-05")).toEqual(date);
  });

  it("rejects malformed and overflowing dates", () => {
    expect(parseISO("")).toBeNull();
    expect(parseISO("12/10/2026")).toBeNull();
    expect(parseISO("2026-13-01")).toBeNull();
    expect(parseISO("2026-02-31")).toBeNull();
  });

  it("accepts a leap day only in a leap year", () => {
    expect(parseISO("2028-02-29")).not.toBeNull();
    expect(parseISO("2027-02-29")).toBeNull();
  });

  it("formats for display", () => {
    expect(formatDisplay(new Date(2026, 0, 5))).toBe("Jan 5, 2026");
    expect(formatDisplay(null)).toBe("");
  });
});

describe("buildCells", () => {
  // October 2026 starts on a Thursday and has 31 days.
  const view = new Date(2026, 9, 1);
  const today = new Date(2026, 9, 15);
  const cells = buildCells(view, "2026-10-20", today);

  it("always fills whole weeks", () => {
    expect(cells.length % 7).toBe(0);
  });

  it("pads the start with the previous month's tail (Sunday-first weeks)", () => {
    // Thursday start → four leading days: 27, 28, 29, 30 September.
    expect(cells.slice(0, 4).map((c) => [c.muted, c.label])).toEqual([
      [true, 27],
      [true, 28],
      [true, 29],
      [true, 30],
    ]);
    expect(cells[4]).toMatchObject({ muted: false, label: 1, iso: "2026-10-01" });
  });

  it("contains every day of the month exactly once, in order", () => {
    const days = cells.filter((c) => !c.muted).map((c) => c.label);
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("pads the end with the next month's start when the last week is partial", () => {
    // November 2026 starts on a Sunday and has 30 days: 30 cells, so 5 trailing.
    const november = buildCells(new Date(2026, 10, 1), "", today);
    expect(november).toHaveLength(35);
    expect(november.slice(-5).map((c) => [c.muted, c.label])).toEqual([
      [true, 1],
      [true, 2],
      [true, 3],
      [true, 4],
      [true, 5],
    ]);
  });

  it("adds no trailing padding when the month ends exactly on a Saturday", () => {
    // October 2026: 4 leading + 31 days = 35 cells, five whole weeks.
    expect(cells).toHaveLength(35);
    expect(cells[cells.length - 1]).toMatchObject({ muted: false, label: 31 });
  });

  it("marks today and the selected day", () => {
    const todayCell = cells.find((c) => !c.muted && c.iso === "2026-10-15");
    const selectedCell = cells.find((c) => !c.muted && c.iso === "2026-10-20");
    expect(todayCell).toMatchObject({ isToday: true, isSelected: false });
    expect(selectedCell).toMatchObject({ isToday: false, isSelected: true });
  });

  it("needs no leading padding when the month starts on Sunday", () => {
    // 1 Feb 2026 is a Sunday.
    expect(buildCells(new Date(2026, 1, 1), "", today)[0]).toMatchObject({
      muted: false,
      label: 1,
    });
  });
});

describe("addMonths", () => {
  it("moves across year boundaries", () => {
    expect(toISO(addMonths(new Date(2026, 11, 1), 1))).toBe("2027-01-01");
    expect(toISO(addMonths(new Date(2026, 0, 1), -1))).toBe("2025-12-01");
  });
});
