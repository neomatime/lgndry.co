import { ACTIVE_PROJECT_STAGES } from "@/features/projects/types";
import type {
  ActiveProjectStage,
  DeliveryStatus,
  PaymentStatus,
  ProjectListItem,
  ProjectStatus,
  ProjectType,
} from "@/features/projects/types";

export type ProjectView = "Active" | "Completed" | "On Hold" | "Cancelled" | "Archived";
export type ProjectSort = "board" | "newest" | "oldest" | "start-date" | "name";
export type ProjectFilters = {
  view: ProjectView;
  search: string;
  clientId?: string;
  projectType?: ProjectType;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
};

export function summarizeProjects(rows: ProjectListItem[]) {
  const current = rows.filter((row) => !row.archived);
  return {
    active: current.filter((row) =>
      ACTIVE_PROJECT_STAGES.includes(row.status as ActiveProjectStage),
    ).length,
    inProduction: current.filter((row) => row.status === "Production").length,
    awaitingApproval: current.filter((row) => row.status === "Review").length,
    readyForDelivery: current.filter((row) => row.deliveryStatus === "Ready for Delivery").length,
  };
}

export function buildBoard(rows: ProjectListItem[]) {
  return Object.fromEntries(
    ACTIVE_PROJECT_STAGES.map((stage) => [
      stage,
      rows
        .filter((row) => !row.archived && row.status === stage)
        .sort((a, b) => a.stagePosition - b.stagePosition || a.id.localeCompare(b.id)),
    ]),
  ) as Record<ActiveProjectStage, ProjectListItem[]>;
}

export function filterProjects(rows: ProjectListItem[], filters: ProjectFilters) {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.view === "Archived" ? !row.archived : row.archived) return false;
    if (
      filters.view === "Active" &&
      !ACTIVE_PROJECT_STAGES.includes(row.status as ActiveProjectStage)
    ) {
      return false;
    }
    if (filters.view !== "Active" && filters.view !== "Archived" && row.status !== filters.view) {
      return false;
    }
    if (filters.clientId && row.clientId !== filters.clientId) return false;
    if (filters.projectType && row.projectType !== filters.projectType) return false;
    if (filters.paymentStatus && row.paymentStatus !== filters.paymentStatus) return false;
    if (filters.deliveryStatus && row.deliveryStatus !== filters.deliveryStatus) return false;
    if (!query) return true;
    return [
      row.name,
      row.clientName,
      row.contact?.fullName ?? "",
      row.contact?.email ?? "",
      row.projectType,
      row.location,
      row.overview,
      ...row.services,
    ].some((value) => value.toLowerCase().includes(query));
  });
}

export function sortProjects(rows: ProjectListItem[], sort: ProjectSort) {
  return [...rows].sort((a, b) => {
    if (sort === "board") {
      return (
        PROJECT_STATUS_ORDER[a.status] - PROJECT_STATUS_ORDER[b.status] ||
        a.stagePosition - b.stagePosition ||
        a.id.localeCompare(b.id)
      );
    }
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "start-date") return (a.startDate || "9999").localeCompare(b.startDate || "9999");
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sort === "newest" ? -delta : delta;
  });
}

const PROJECT_STATUS_ORDER = Object.fromEntries(
  [...ACTIVE_PROJECT_STAGES, "Completed", "On Hold", "Cancelled"].map((status, index) => [
    status,
    index,
  ]),
) as Record<ProjectStatus, number>;

export function getDeliverableProgress(project: Pick<ProjectListItem, "deliverables">) {
  const total = project.deliverables.length;
  const completed = project.deliverables.filter((item) => item.status === "Delivered").length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function getNextAction(project: Pick<ProjectListItem, "tasks">) {
  return (
    [...project.tasks]
      .filter((task) => !task.isCompleted)
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.sortOrder - b.sortOrder;
      })[0] ?? null
  );
}

export function moveProjectOptimistically(
  board: Record<ActiveProjectStage, ProjectListItem[]>,
  projectId: string,
  destination: ActiveProjectStage,
  destinationIndex: number,
) {
  const next = Object.fromEntries(
    ACTIVE_PROJECT_STAGES.map((stage) => [
      stage,
      board[stage].filter((row) => row.id !== projectId),
    ]),
  ) as Record<ActiveProjectStage, ProjectListItem[]>;
  const project = ACTIVE_PROJECT_STAGES.flatMap((stage) => board[stage]).find(
    (row) => row.id === projectId,
  );
  if (!project) return board;
  const index = Math.max(0, Math.min(destinationIndex, next[destination].length));
  next[destination].splice(index, 0, { ...project, status: destination });
  for (const stage of ACTIVE_PROJECT_STAGES) {
    next[stage] = next[stage].map((row, stagePosition) => ({ ...row, stagePosition }));
  }
  return next;
}
