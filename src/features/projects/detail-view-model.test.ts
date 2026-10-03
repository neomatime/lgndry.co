import { describe, expect, it } from "vitest";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";
import {
  buildProjectDetail,
  buildProjectDetailSummary,
  type ProjectDetailRecord,
} from "@/features/projects/detail-view-model";
import type { ProjectDetail } from "@/features/projects/types";

describe("buildProjectDetailSummary", () => {
  it("formats same-day dates, budget, progress, and next action", () => {
    const project = {
      startDate: "2026-10-01",
      endDate: "2026-10-01",
      budgetMin: 1000,
      budgetMax: 2500,
      currency: "ZAR",
      deliverables: [
        {
          id: "d",
          title: "Film",
          dueDate: "",
          status: "Delivered",
          sortOrder: 0,
          completedAt: null,
        },
      ],
      tasks: [
        {
          id: "t",
          title: "Confirm",
          dueDate: "",
          isCompleted: false,
          sortOrder: 0,
          completedAt: null,
        },
      ],
    } as unknown as ProjectDetail;
    const result = buildProjectDetailSummary(project);
    expect(result.dateRange).toBe("2026-10-01");
    expect(result.budget).toEqual({ minimum: 1000, maximum: 2500, currency: "ZAR" });
    expect(result.progress.percent).toBe(100);
    expect(result.nextAction?.title).toBe("Confirm");
  });

  it("uses explicit empty labels for unscheduled and unbudgeted work", () => {
    const result = buildProjectDetailSummary({
      startDate: "",
      endDate: "",
      budgetMin: null,
      budgetMax: null,
      currency: "ZAR",
      deliverables: [],
      tasks: [],
    } as unknown as ProjectDetail);
    expect(result.dateRange).toBe("Not scheduled");
    expect(result.budget).toBeNull();
  });
});

describe("buildProjectDetail follow-ups", () => {
  const record = {
    id: "p",
    name: "Autumn Campaign",
    client: "c",
    client_contact_id: null,
    project_type: "Film",
    services: [],
    brief: null,
    location: null,
    start_date: null,
    end_date: null,
    timeline: null,
    people_resources: null,
    budget_min: null,
    budget_max: null,
    currency: "ZAR",
    status: "Planning",
    stage_position: 0,
    payment_status: "Not Invoiced",
    delivery_status: "Not Ready",
    archived: false,
    created_at: "2026-09-01T08:00:00Z",
    updated_at: "2026-09-01T08:00:00Z",
    enquiry_id: null,
    booking: null,
    client_record: { id: "c", name: "Blackridge" },
    contact_record: null,
    project_tasks: null,
    project_deliverables: null,
  } as unknown as ProjectDetailRecord;
  const now = new Date("2026-09-30T08:00:00Z");

  it("defaults to no follow-ups and a live client", () => {
    const detail = buildProjectDetail(record, [], [], [], null, null, [], now);
    expect(detail.followUps).toMatchObject({ total: 0, actionable: [] });
    expect(detail.clientArchived).toBe(false);
  });

  it("carries the grouped follow-ups and the client's archived flag", () => {
    const detail = buildProjectDetail(
      { ...record, client_record: { id: "c", name: "Blackridge", archived: true } },
      [],
      [],
      [],
      null,
      null,
      [],
      now,
      [
        followUpDetail({ id: "open", dueDate: "2026-10-10", dueTime: "" }),
        followUpDetail({ id: "gone", status: "Cancelled", cancelledAt: "2026-09-29T08:00:00Z" }),
      ],
    );
    expect(detail.clientArchived).toBe(true);
    expect(detail.followUps.actionable.map((row) => row.id)).toEqual(["open"]);
    expect(detail.followUps.cancelled.map((row) => row.id)).toEqual(["gone"]);
    expect(detail.followUps.now).toBe("2026-09-30T08:00:00.000Z");
  });
});
