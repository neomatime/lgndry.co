import { describe, expect, it } from "vitest";
import { formatJohannesburgTimestamp } from "@/features/follow-ups/timestamp-label";

describe("formatJohannesburgTimestamp", () => {
  it("reads the instant in Johannesburg time", () => {
    expect(formatJohannesburgTimestamp("2026-05-29T09:00:00Z")).toBe("Fri, 29 May 2026, 11:00");
  });

  it("rolls the calendar date over when Johannesburg is already into the next day", () => {
    expect(formatJohannesburgTimestamp("2026-05-29T22:30:00Z")).toBe("Sat, 30 May 2026, 00:30");
  });

  it("returns an empty string for an invalid timestamp", () => {
    expect(formatJohannesburgTimestamp("not-a-date")).toBe("");
  });
});
