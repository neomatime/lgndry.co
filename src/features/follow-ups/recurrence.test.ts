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

  it("handles a day-31 monthly anchor without drifting", () => {
    const rule = createRecurrenceRule("2026-01-31", {
      enabled: true,
      frequency: "Monthly",
      intervalCount: 1,
      weekdays: [],
      monthAnchor: 31,
      endsOn: "",
      maxOccurrences: null,
    });
    expect(nextOccurrenceDate("2026-01-31", rule)).toBe("2026-03-31");
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
});
