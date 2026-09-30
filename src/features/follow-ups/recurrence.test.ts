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

  it("stops at recurrence count and returns null for malformed rules", () => {
    const rule = createRecurrenceRule("2026-09-30", {
      enabled: true,
      frequency: "Daily",
      intervalCount: 1,
      weekdays: [],
      monthAnchor: null,
      endsOn: "",
      maxOccurrences: 2,
    });
    expect(nextOccurrenceDate("2026-10-01", rule)).toBeNull();
    expect(nextOccurrenceDate("2026-10-01", "not-a-rule")).toBeNull();
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
