import { describe, expect, it } from "vitest";
import { buildProjectDetailSummary } from "@/features/projects/detail-view-model";
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
