import { describe, expect, it } from "vitest";
import { enquiryEditSchema } from "@/features/enquiries/schemas";

const input = {
  fullName: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  projectType: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
};

describe("enquiryEditSchema", () => {
  it("normalizes a valid enquiry edit", () => {
    expect(
      enquiryEditSchema.parse({ ...input, fullName: "  Thandi Mokoena  ", company: "  " }),
    ).toMatchObject({ fullName: "Thandi Mokoena", company: "" });
  });

  it("rejects invalid contact and project details", () => {
    const result = enquiryEditSchema.safeParse({ ...input, email: "bad", description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported project types", () => {
    expect(enquiryEditSchema.safeParse({ ...input, projectType: "Wedding" }).success).toBe(false);
  });
});
