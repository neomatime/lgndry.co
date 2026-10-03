import { describe, expect, it } from "vitest";
import { buildClientDetail } from "@/features/clients/detail-view-model";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

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
      [
        {
          id: "project-1",
          name: "Autumn Campaign",
          status: "Production",
          start_date: "2026-03-01",
          end_date: "2026-03-10",
          delivery_status: "In progress",
          archived: false,
        },
      ],
      [{ id: "a", message: "Created", created_at: "2026-01-01T00:00:00Z" }],
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(detail.contacts[0]?.id).toBe("1");
    expect(detail.enquiries[0]?.id).toBe("new");
    expect(detail.projects[0]).toMatchObject({ id: "project-1", name: "Autumn Campaign" });
    expect(detail.openEnquiryCount).toBe(1);
    expect(detail.activity[0]?.relativeTime).toBe("yesterday");
  });
});

describe("buildClientDetail follow-ups", () => {
  const client = {
    id: "c",
    name: "Client",
    type: "Company" as const,
    status: "Active" as const,
    account_tier: "Standard" as const,
    industry: null,
    region: null,
    client_since: "2026-01-01",
    account_overview: null,
    preferred_services: [],
    relationship_notes: null,
    archived: false,
  };
  const now = new Date("2026-09-30T08:00:00Z");

  it("defaults to no follow-ups", () => {
    const detail = buildClientDetail(client, [], [], [], [], now);
    expect(detail.followUps).toMatchObject({
      total: 0,
      actionable: [],
      completed: [],
      cancelled: [],
    });
  });

  it("groups the supplied follow-ups against the same now as the rest of the page", () => {
    const detail = buildClientDetail(client, [], [], [], [], now, [
      followUpDetail({ id: "late", scheduleState: "Upcoming", dueDate: "2026-09-29", dueTime: "" }),
      followUpDetail({ id: "done", status: "Completed", completedAt: "2026-09-29T08:00:00Z" }),
    ]);
    expect(detail.followUps.now).toBe("2026-09-30T08:00:00.000Z");
    expect(detail.followUps.actionable.map((row) => [row.id, row.scheduleState])).toEqual([
      ["late", "Overdue"],
    ]);
    expect(detail.followUps.completed.map((row) => row.id)).toEqual(["done"]);
    expect(detail.followUps.total).toBe(2);
  });
});
