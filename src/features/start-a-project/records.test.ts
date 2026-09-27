import { describe, expect, it } from "vitest";
import type { ProjectEnquiryInput } from "@/features/start-a-project/schemas";
import {
  enquiryActivityMessage,
  newClientNotes,
  submitEnquiryArgs,
  type UploadedFile,
} from "@/features/start-a-project/records";

describe("newClientNotes", () => {
  it("records the company name", () => {
    expect(newClientNotes("Blackridge Hotels")).toBe("Company: Blackridge Hotels");
  });

  it("uses a dash when there is no company", () => {
    expect(newClientNotes("")).toBe("Company: -");
  });
});

describe("enquiryActivityMessage", () => {
  it("names who sent it", () => {
    expect(enquiryActivityMessage("Thandi Mokoena")).toBe(
      "New project enquiry from Thandi Mokoena",
    );
  });

  it("falls back for an anonymous name", () => {
    expect(enquiryActivityMessage("")).toBe("New project enquiry from website visitor");
  });

  it("stays within the database's 200-character limit", () => {
    expect(enquiryActivityMessage("x".repeat(300)).length).toBe(200);
  });
});

const input = (over: Partial<ProjectEnquiryInput> = {}): ProjectEnquiryInput => ({
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  ...over,
});

const file = (over: Partial<UploadedFile> = {}): UploadedFile => ({
  storage_path: "abc/0-brief.pdf",
  file_name: "brief.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
  ...over,
});

describe("submitEnquiryArgs", () => {
  it("maps every field to the submit_enquiry() parameter names", () => {
    expect(submitEnquiryArgs(input(), [file()])).toEqual({
      full_name: "Thandi Mokoena",
      company: "Blackridge Hotels",
      email: "thandi@example.com",
      phone: "0761234567",
      project_type: "Documentary",
      location: "Polokwane",
      timeline: "Next 1-3 months",
      description: "A short documentary series.",
      budget: "R20,000 - R35,000",
      client_notes: "Company: Blackridge Hotels",
      attachments: [file()],
    });
  });

  it("sends null for an empty company or budget, and an empty attachments array", () => {
    const args = submitEnquiryArgs(input({ company: "", budget: "" }), []);
    expect(args.company).toBeNull();
    expect(args.budget).toBeNull();
    expect(args.attachments).toEqual([]);
    expect(args.client_notes).toBe("Company: -");
  });
});
