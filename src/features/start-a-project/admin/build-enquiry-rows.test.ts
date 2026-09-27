import { describe, expect, it } from "vitest";
import { buildEnquiryRows } from "@/features/start-a-project/admin/build-enquiry-rows";

const enquiry = {
  id: "e1",
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  project_type: "Documentary",
  status: "New",
  created_at: "2026-09-27T10:00:00Z",
};

describe("buildEnquiryRows", () => {
  it("maps an enquiry with its attachments and signed urls", () => {
    const rows = buildEnquiryRows(
      [enquiry],
      new Map([["e1", [{ file_name: "brief.pdf", storage_path: "abc/0-brief.pdf" }]]]),
      new Map([["abc/0-brief.pdf", "https://signed.example/abc/0-brief.pdf"]]),
    );

    expect(rows).toEqual([
      {
        id: "e1",
        fullName: "Thandi Mokoena",
        company: "Blackridge Hotels",
        email: "thandi@example.com",
        projectType: "Documentary",
        status: "New",
        submittedAt: "2026-09-27T10:00:00Z",
        attachments: [{ fileName: "brief.pdf", url: "https://signed.example/abc/0-brief.pdf" }],
      },
    ]);
  });

  it("gives an enquiry with no attachments an empty list", () => {
    const rows = buildEnquiryRows([enquiry], new Map(), new Map());
    expect(rows[0]!.attachments).toEqual([]);
  });

  it("gives null for a file whose signed url could not be created", () => {
    const rows = buildEnquiryRows(
      [enquiry],
      new Map([["e1", [{ file_name: "brief.pdf", storage_path: "abc/0-brief.pdf" }]]]),
      new Map(),
    );
    expect(rows[0]!.attachments).toEqual([{ fileName: "brief.pdf", url: null }]);
  });
});
