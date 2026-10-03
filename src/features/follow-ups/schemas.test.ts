import { describe, expect, it } from "vitest";
import { followUpInputSchema, rescheduleFollowUpSchema } from "@/features/follow-ups/schemas";

describe("rescheduleFollowUpSchema", () => {
  it('accepts only scope "occurrence" (the backend "future" reschedule is not exposed)', () => {
    const input = { dueDate: "2026-10-10", dueTime: "09:00" };
    expect(rescheduleFollowUpSchema.safeParse({ ...input, scope: "occurrence" }).success).toBe(
      true,
    );
    expect(rescheduleFollowUpSchema.safeParse({ ...input, scope: "future" }).success).toBe(false);
    expect(rescheduleFollowUpSchema.safeParse(input).success).toBe(false);
  });
});

const valid = {
  clientId: "11111111-1111-4111-8111-111111111111",
  contactId: "",
  enquiryId: "",
  projectId: "",
  followUpType: "Client Check-in" as const,
  customType: "",
  title: "Check in after the shoot",
  overview: "",
  notes: "",
  dueDate: "2026-10-02",
  dueTime: "09:30",
  priority: "Medium" as const,
  contactMethods: ["Email" as const],
  checklist: [{ label: "Review notes", sortOrder: 9 }],
  recurrence: {
    enabled: false,
    frequency: "Weekly" as const,
    intervalCount: 1,
    weekdays: [],
    monthAnchor: null,
    endsOn: "",
    maxOccurrences: null,
  },
  editScope: "occurrence" as const,
};

describe("followUpInputSchema", () => {
  it("normalizes checklist order and duplicate methods", () => {
    const result = followUpInputSchema.parse({
      ...valid,
      contactMethods: ["Email", "Email"],
    });
    expect(result.contactMethods).toEqual(["Email"]);
    expect(result.checklist[0]?.sortOrder).toBe(0);
  });

  it("requires a custom label for Other", () => {
    const result = followUpInputSchema.safeParse({ ...valid, followUpType: "Other" });
    expect(result.success).toBe(false);
  });

  it("prevents linking an enquiry and project together", () => {
    const result = followUpInputSchema.safeParse({
      ...valid,
      enquiryId: "22222222-2222-4222-8222-222222222222",
      projectId: "33333333-3333-4333-8333-333333333333",
    });
    expect(result.success).toBe(false);
  });

  it("validates recurrence-specific fields", () => {
    const result = followUpInputSchema.safeParse({
      ...valid,
      recurrence: { ...valid.recurrence, enabled: true, frequency: "Weekly" },
    });
    expect(result.success).toBe(false);
  });
});
