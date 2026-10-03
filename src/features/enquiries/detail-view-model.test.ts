import { describe, expect, it } from "vitest";
import { buildEnquiryDetail } from "@/features/enquiries/detail-view-model";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

const enquiry = {
  id: "e1",
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary" as const,
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  status: "New" as const,
  source: "Website",
  created_at: "2026-09-27T10:00:00Z",
  client_id: "client-1" as string | null,
  archived: false,
};

const NOW = new Date("2026-09-27T12:00:00Z");

describe("buildEnquiryDetail", () => {
  it("shapes the enquiry, its attachments and its activity", () => {
    const detail = buildEnquiryDetail(
      enquiry,
      [{ file_name: "brief.pdf", storage_path: "e1/0-brief.pdf", size_bytes: 2_400_000 }],
      new Map([["e1/0-brief.pdf", "https://signed.example/brief.pdf"]]),
      [
        {
          id: "a1",
          message: "New project enquiry from Thandi Mokoena",
          created_at: "2026-09-27T10:00:00Z",
        },
      ],
      NOW,
    );

    expect(detail.id).toBe("e1");
    expect(detail.attachments).toEqual([
      { fileName: "brief.pdf", sizeBytes: 2_400_000, url: "https://signed.example/brief.pdf" },
    ]);
    expect(detail.activity).toEqual([
      { id: "a1", message: "New project enquiry from Thandi Mokoena", relativeTime: "2 hours ago" },
    ]);
  });

  it("gives an attachment with no signed url a null url", () => {
    const detail = buildEnquiryDetail(
      enquiry,
      [{ file_name: "brief.pdf", storage_path: "e1/0-brief.pdf", size_bytes: 1024 }],
      new Map(),
      [],
      NOW,
    );
    expect(detail.attachments[0]!.url).toBeNull();
  });

  it("handles a null company and null budget without throwing", () => {
    const detail = buildEnquiryDetail(
      { ...enquiry, company: null, budget: null },
      [],
      new Map(),
      [],
      NOW,
    );
    expect(detail.company).toBeNull();
    expect(detail.budget).toBeNull();
  });

  it("includes the project created from the enquiry", () => {
    const project = { id: "p1", name: "Autumn Campaign", status: "Production" };
    const detail = buildEnquiryDetail(enquiry, [], new Map(), [], NOW, project);
    expect(detail.project).toEqual(project);
  });
});

describe("buildEnquiryDetail follow-ups and client link", () => {
  it("carries the client link and archived flags", () => {
    const detail = buildEnquiryDetail(
      { ...enquiry, archived: true },
      [],
      new Map(),
      [],
      NOW,
      null,
      [],
      true,
    );
    expect(detail.clientId).toBe("client-1");
    expect(detail.archived).toBe(true);
    expect(detail.clientArchived).toBe(true);
  });

  it("keeps a missing client as null and defaults the flags to live", () => {
    const detail = buildEnquiryDetail({ ...enquiry, client_id: null }, [], new Map(), [], NOW);
    expect(detail.clientId).toBeNull();
    expect(detail.archived).toBe(false);
    expect(detail.clientArchived).toBe(false);
    expect(detail.followUps).toMatchObject({ total: 0, actionable: [] });
  });

  it("groups the supplied follow-ups against the same now", () => {
    const detail = buildEnquiryDetail(enquiry, [], new Map(), [], NOW, null, [
      followUpDetail({ id: "late", scheduleState: "Upcoming", dueDate: "2026-09-26", dueTime: "" }),
      followUpDetail({ id: "done", status: "Completed", completedAt: "2026-09-26T08:00:00Z" }),
    ]);
    expect(detail.followUps.now).toBe("2026-09-27T12:00:00.000Z");
    expect(detail.followUps.actionable.map((row) => [row.id, row.scheduleState])).toEqual([
      ["late", "Overdue"],
    ]);
    expect(detail.followUps.completed.map((row) => row.id)).toEqual(["done"]);
  });
});
