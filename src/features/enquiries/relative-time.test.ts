import { describe, expect, it } from "vitest";
import { relativeTime } from "@/features/enquiries/relative-time";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("relativeTime", () => {
  it("says 'just now' for anything under a minute", () => {
    expect(relativeTime("2026-09-27T11:59:30Z", NOW)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(relativeTime("2026-09-27T11:55:00Z", NOW)).toBe("5 minutes ago");
  });

  it("formats hours", () => {
    expect(relativeTime("2026-09-27T10:00:00Z", NOW)).toBe("2 hours ago");
  });

  it("formats days", () => {
    expect(relativeTime("2026-09-24T12:00:00Z", NOW)).toBe("3 days ago");
  });
});
