import type { ProjectDetail } from "@/features/projects/types";
import { getDeliverableProgress, getNextAction } from "@/features/projects/list-view-model";

export function buildProjectDetailSummary(project: ProjectDetail) {
  return {
    progress: getDeliverableProgress(project),
    nextAction: getNextAction(project),
    dateRange:
      project.startDate && project.endDate
        ? project.startDate === project.endDate
          ? project.startDate
          : `${project.startDate} - ${project.endDate}`
        : project.startDate || project.endDate || "Not scheduled",
    budget:
      project.budgetMin === null && project.budgetMax === null
        ? null
        : {
            minimum: project.budgetMin,
            maximum: project.budgetMax,
            currency: project.currency,
          },
  };
}
