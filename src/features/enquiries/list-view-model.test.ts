import { describe, expect, it } from "vitest";
import {
  buildEnquiryListItems,
  computeEnquiryStats,
  countByStatus,
  filterEnquiries,
  sortEnquiries,
  type EnquiryListItem,
  type EnquiryRecord,
} from "@/features/enquiries/list-view-model";

const enquiryRecord = (over: Partial<EnquiryRecord> = {}): EnquiryRecord => ({
  id: "e1",
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  status: "New",
  created_at: "2026-09-27T10:00:00Z",
  ...over,
});

describe("buildEnquiryListItems", () => {
  it("shapes an enquiry record with its attachment count", () => {
    const items = buildEnquiryListItems([enquiryRecord()], new Map([["e1", 2]]));
    expect(items).toEqual([
      {
        id: "e1",
        fullName: "Thandi Mokoena",
        company: "Blackridge Hotels",
        email: "thandi@example.com",
        phone: "0761234567",
        projectType: "Documentary",
        location: "Polokwane",
        timeline: "Next 1-3 months",
        description: "A short documentary series.",
        budget: "R20,000 - R35,000",
        status: "New",
        createdAt: "2026-09-27T10:00:00Z",
        attachmentCount: 2,
      },
    ]);
  });

  it("gives an enquiry with no matching entry a zero attachment count", () => {
    const items = buildEnquiryListItems([enquiryRecord()], new Map());
    expect(items[0]!.attachmentCount).toBe(0);
  });

  it("handles a null company without throwing", () => {
    const items = buildEnquiryListItems([enquiryRecord({ company: null })], new Map());
    expect(items[0]!.company).toBeNull();
  });
});

function item(over: Partial<EnquiryListItem> = {}): EnquiryListItem {
  return {
    id: "e1",
    fullName: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    projectType: "Documentary",
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    status: "New",
    createdAt: "2026-09-27T10:00:00Z",
    attachmentCount: 1,
    ...over,
  };
}

describe("computeEnquiryStats", () => {
  it("counts New, Reviewing, Quoted and missing-attachments correctly", () => {
    const rows = [
      item({ id: "1", status: "New" }),
      item({ id: "2", status: "New" }),
      item({ id: "3", status: "Reviewing" }),
      item({ id: "4", status: "Quoted", attachmentCount: 0 }),
      item({ id: "5", status: "Closed", attachmentCount: 0 }),
    ];
    expect(computeEnquiryStats(rows)).toEqual({
      New: 2,
      Reviewing: 1,
      Quoted: 1,
      missingAttachments: 2,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(computeEnquiryStats([])).toEqual({
      New: 0,
      Reviewing: 0,
      Quoted: 0,
      missingAttachments: 0,
    });
  });
});

describe("countByStatus", () => {
  it("counts every one of the 8 real statuses, including ones with zero rows", () => {
    const rows = [item({ id: "1", status: "New" }), item({ id: "2", status: "New" })];
    expect(countByStatus(rows)).toEqual({
      New: 2,
      Reviewing: 0,
      Quoted: 0,
      "Follow-up": 0,
      Booked: 0,
      "In Production": 0,
      Completed: 0,
      Closed: 0,
    });
  });
});

describe("filterEnquiries", () => {
  const rows = [
    item({ id: "1", fullName: "Thandi Mokoena", company: "Blackridge Hotels", status: "New" }),
    item({
      id: "2",
      fullName: "James Mitchell",
      company: null,
      status: "Quoted",
      projectType: "Film",
    }),
  ];

  it("returns everything for status All and an empty search", () => {
    expect(filterEnquiries(rows, { status: "All", search: "" })).toHaveLength(2);
  });

  it("filters by exact status", () => {
    const result = filterEnquiries(rows, { status: "Quoted", search: "" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("searches case-insensitively across name, company, email and project type", () => {
    expect(filterEnquiries(rows, { status: "All", search: "blackridge" })).toHaveLength(1);
    expect(filterEnquiries(rows, { status: "All", search: "FILM" })).toHaveLength(1);
  });

  it("doesn't throw when a row's company is null", () => {
    expect(() => filterEnquiries(rows, { status: "All", search: "mitchell" })).not.toThrow();
    expect(filterEnquiries(rows, { status: "All", search: "mitchell" })).toHaveLength(1);
  });
});

describe("sortEnquiries", () => {
  const rows = [
    item({ id: "old", createdAt: "2026-09-01T00:00:00Z" }),
    item({ id: "new", createdAt: "2026-09-27T00:00:00Z" }),
  ];

  it("sorts newest first", () => {
    expect(sortEnquiries(rows, "newest").map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("sorts oldest first", () => {
    expect(sortEnquiries(rows, "oldest").map((r) => r.id)).toEqual(["old", "new"]);
  });
});
