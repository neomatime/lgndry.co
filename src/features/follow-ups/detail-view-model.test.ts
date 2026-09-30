import { describe, expect, it } from "vitest";
import { followUpDetailToInput } from "@/features/follow-ups/detail-view-model";
import type { FollowUpDetail } from "@/features/follow-ups/types";

describe("followUpDetailToInput", () => {
  it("maps linked records and recurrence back to editable values", () => {
    const detail = {
      clientId: "client",
      contact: null,
      related: { id: "project", label: "Film", kind: "Project" },
      followUpType: "Approval",
      customType: "",
      title: "Review",
      overview: "Overview",
      notes: "Notes",
      dueDate: "2026-10-01",
      dueTime: "10:00",
      priority: "High",
      contactMethods: ["Email"],
      checklist: [],
      seriesId: "series",
      series: {
        id: "series",
        frequency: "Monthly",
        intervalCount: 1,
        weekdays: [],
        monthAnchor: 1,
        recurrenceRule: "rule",
        endsOn: "",
        maxOccurrences: null,
        occurrencesCreated: 1,
        active: true,
        version: 1,
      },
    } as unknown as FollowUpDetail;
    const input = followUpDetailToInput(detail);
    expect(input.projectId).toBe("project");
    expect(input.enquiryId).toBe("");
    expect(input.recurrence.frequency).toBe("Monthly");
  });
});
