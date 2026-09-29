import { describe, expect, it } from "vitest";
import { buildClientDetail } from "@/features/clients/detail-view-model";

describe("buildClientDetail", () => {
  it("puts the primary contact and newest enquiry first", () => {
    const detail = buildClientDetail(
      {
        id: "c",
        name: "Client",
        type: "Company",
        status: "Active",
        account_tier: "Standard",
        industry: null,
        region: null,
        client_since: "2026-01-01",
        account_overview: null,
        preferred_services: [],
        relationship_notes: null,
        archived: false,
      },
      [
        {
          id: "2",
          full_name: "Second",
          role_title: null,
          email: "2@test.com",
          phone: null,
          is_primary: false,
        },
        {
          id: "1",
          full_name: "First",
          role_title: "Owner",
          email: "1@test.com",
          phone: null,
          is_primary: true,
        },
      ],
      [
        { id: "old", project_type: "Film", status: "Closed", created_at: "2026-01-01T00:00:00Z" },
        { id: "new", project_type: "Event", status: "New", created_at: "2026-02-01T00:00:00Z" },
      ],
      [{ id: "a", message: "Created", created_at: "2026-01-01T00:00:00Z" }],
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(detail.contacts[0]?.id).toBe("1");
    expect(detail.enquiries[0]?.id).toBe("new");
    expect(detail.openEnquiryCount).toBe(1);
    expect(detail.activity[0]?.relativeTime).toBe("yesterday");
  });
});
