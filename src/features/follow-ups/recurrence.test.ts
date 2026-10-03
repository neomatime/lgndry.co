import { RRule } from "rrule";
import { describe, expect, it } from "vitest";
import {
  createRecurrenceRule,
  nextOccurrenceDate,
  recurrenceSummary,
} from "@/features/follow-ups/recurrence";

describe("follow-up recurrence", () => {
  it("finds the next daily occurrence", () => {
    const rule = createRecurrenceRule("2026-09-30", {
      enabled: true,
      frequency: "Daily",
      intervalCount: 2,
      weekdays: [],
      monthAnchor: null,
      endsOn: "",
      maxOccurrences: null,
    });
    expect(nextOccurrenceDate("2026-09-30", rule)).toBe("2026-10-02");
  });

  it("supports selected weekdays", () => {
    const rule = createRecurrenceRule("2026-09-30", {
      enabled: true,
      frequency: "Weekly",
      intervalCount: 1,
      weekdays: [1, 5],
      monthAnchor: null,
      endsOn: "",
      maxOccurrences: null,
    });
    expect(nextOccurrenceDate("2026-09-30", rule)).toBe("2026-10-02");
  });

  it("clamps a day-31 monthly anchor to the shorter month's last day instead of skipping it", () => {
    const rule = createRecurrenceRule("2026-01-31", {
      enabled: true,
      frequency: "Monthly",
      intervalCount: 1,
      weekdays: [],
      monthAnchor: 31,
      endsOn: "",
      maxOccurrences: null,
    });
    // 2026 is not a leap year: Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31.
    // The previous behavior skipped Feb and Apr entirely (Jan 31 -> Mar 31
    // -> May 31) because rrule omits any month lacking the anchor day.
    expect(nextOccurrenceDate("2026-01-31", rule)).toBe("2026-02-28");
    expect(nextOccurrenceDate("2026-02-28", rule)).toBe("2026-03-31");
    expect(nextOccurrenceDate("2026-03-31", rule)).toBe("2026-04-30");
    expect(nextOccurrenceDate("2026-04-30", rule)).toBe("2026-05-31");
  });

  it("clamps a day-31 monthly anchor to Feb 29 in a leap year", () => {
    const rule = createRecurrenceRule("2028-01-31", {
      enabled: true,
      frequency: "Monthly",
      intervalCount: 1,
      weekdays: [],
      monthAnchor: 31,
      endsOn: "",
      maxOccurrences: null,
    });
    // 2028 is a leap year.
    expect(nextOccurrenceDate("2028-01-31", rule)).toBe("2028-02-29");
  });

  it("ignores the rule's COUNT for the next date (the database enforces the limit) and returns null for malformed rules", () => {
    // Previously this returned null: rrule's own COUNT=2 (Sep 30, Oct 1) was exhausted. The
    // occurrence limit is enforced by the database (max_occurrences vs occurrences_created),
    // which knows how many occurrences were really created; rrule only counts pattern dates.
    const rule = createRecurrenceRule("2026-09-30", {
      enabled: true,
      frequency: "Daily",
      intervalCount: 1,
      weekdays: [],
      monthAnchor: null,
      endsOn: "",
      maxOccurrences: 2,
    });
    expect(rule).toContain("COUNT=2");
    expect(nextOccurrenceDate("2026-10-01", rule)).toBe("2026-10-02");
    expect(nextOccurrenceDate("2026-10-01", "not-a-rule")).toBeNull();
  });

  describe('"After N occurrences" series', () => {
    const weeklyAfterFive = createRecurrenceRule("2026-10-05", {
      enabled: true,
      frequency: "Weekly",
      intervalCount: 1,
      weekdays: [1],
      monthAnchor: null,
      endsOn: "",
      maxOccurrences: 5,
    });

    it("keeps the count in the stored rule string", () => {
      expect(weeklyAfterFive).toContain("COUNT=5");
      expect(weeklyAfterFive).toContain("DTSTART:20261005T120000Z");
    });

    it("keeps producing successors after the first occurrence was rescheduled off the pattern", () => {
      // Pattern dates with COUNT=5: Oct 5, 12, 19, 26, Nov 2. The first occurrence was
      // rescheduled two weeks ahead to Oct 19, so the series' real occurrences are
      // Oct 19 (1), Oct 26 (2), Nov 2 (3), Nov 9 (4), Nov 16 (5).
      // Sanity check that the scenario is real: rrule with its COUNT stops after Nov 2.
      expect(RRule.fromString(weeklyAfterFive).after(new Date("2026-11-02T12:00:00Z"))).toBeNull();

      const dates = ["2026-10-19"];
      for (let created = 1; created < 5; created += 1) {
        const next = nextOccurrenceDate(dates.at(-1)!, weeklyAfterFive);
        expect(next).not.toBeNull();
        dates.push(next!);
      }
      expect(dates).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
    });

    it("still stops at the end date (UNTIL), even with a count", () => {
      const rule = createRecurrenceRule("2026-10-05", {
        enabled: true,
        frequency: "Weekly",
        intervalCount: 1,
        weekdays: [1],
        monthAnchor: null,
        endsOn: "2026-10-20",
        maxOccurrences: 5,
      });
      expect(nextOccurrenceDate("2026-10-12", rule)).toBe("2026-10-19");
      expect(nextOccurrenceDate("2026-10-19", rule)).toBeNull();
    });

    it("still stops at the end date (UNTIL) without a count", () => {
      const rule = createRecurrenceRule("2026-09-30", {
        enabled: true,
        frequency: "Daily",
        intervalCount: 1,
        weekdays: [],
        monthAnchor: null,
        endsOn: "2026-10-02",
        maxOccurrences: null,
      });
      expect(nextOccurrenceDate("2026-10-01", rule)).toBe("2026-10-02");
      expect(nextOccurrenceDate("2026-10-02", rule)).toBeNull();
    });

    it("daily with a count keeps producing successors past rrule's COUNT", () => {
      const rule = createRecurrenceRule("2026-09-30", {
        enabled: true,
        frequency: "Daily",
        intervalCount: 2,
        weekdays: [],
        monthAnchor: null,
        endsOn: "",
        maxOccurrences: 3,
      });
      // Completed late: the occurrence due Oct 2 was moved to Oct 5 (off the every-2-days
      // pattern from Sep 30). rrule's COUNT=3 pattern (Sep 30, Oct 2, Oct 4) is exhausted.
      expect(nextOccurrenceDate("2026-10-05", rule)).toBe("2026-10-06");
      expect(nextOccurrenceDate("2026-10-06", rule)).toBe("2026-10-08");
    });

    it("monthly with a count keeps producing successors past rrule's COUNT", () => {
      const rule = createRecurrenceRule("2026-01-15", {
        enabled: true,
        frequency: "Monthly",
        intervalCount: 1,
        weekdays: [],
        monthAnchor: 15,
        endsOn: "",
        maxOccurrences: 2,
      });
      expect(rule).toContain("COUNT=2");
      expect(nextOccurrenceDate("2026-02-15", rule)).toBe("2026-03-15");
      expect(nextOccurrenceDate("2026-03-15", rule)).toBe("2026-04-15");
    });
  });

  it("describes recurrence in plain language", () => {
    expect(
      recurrenceSummary({
        enabled: true,
        frequency: "Weekly",
        intervalCount: 1,
        weekdays: [1, 5],
        monthAnchor: null,
        endsOn: "",
        maxOccurrences: null,
      }),
    ).toContain("Mon, Fri");
  });

  it("pluralizes 'day' correctly instead of mangling it to 'dais'", () => {
    expect(
      recurrenceSummary({
        enabled: true,
        frequency: "Daily",
        intervalCount: 2,
        weekdays: [],
        monthAnchor: null,
        endsOn: "",
        maxOccurrences: null,
      }),
    ).toBe("Every 2 days");
  });

  it("still pluralizes weekly and monthly correctly", () => {
    expect(
      recurrenceSummary({
        enabled: true,
        frequency: "Weekly",
        intervalCount: 2,
        weekdays: [],
        monthAnchor: null,
        endsOn: "",
        maxOccurrences: null,
      }),
    ).toBe("Every 2 weeks");
    expect(
      recurrenceSummary({
        enabled: true,
        frequency: "Monthly",
        intervalCount: 3,
        weekdays: [],
        monthAnchor: null,
        endsOn: "",
        maxOccurrences: null,
      }),
    ).toBe("Every 3 months");
  });
});
