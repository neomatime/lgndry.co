import type { ProjectDetail, ProjectInput, ProjectMilestone } from "@/features/projects/types";
import {
  getDeliverableProgress,
  getNextAction,
  shapeProjectActivity,
  shapeProjectDeliverable,
  shapeProjectRows,
  shapeProjectTask,
  type ProjectActivityRecord,
  type ProjectDeliverableRecord,
  type ProjectListRecord,
  type ProjectTaskRecord,
} from "@/features/projects/list-view-model";

export type ProjectDetailRecord = ProjectListRecord & {
  timeline: string | null;
  people_resources: string | null;
  budget_min: number | string | null;
  budget_max: number | string | null;
  currency: string;
};

export type ProjectMilestoneRecord = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "Pending" | "Completed";
  sort_order: number;
  completed_at: string | null;
};

export type ProjectEnquiryRecord = {
  id: string;
  status: string;
  project_type: string;
};

export type ProjectBookingRecord = {
  id: string;
  date: string | null;
  location: string | null;
  status: string;
  deposit: string;
};

function optionalNumber(value: number | string | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function shapeProjectMilestone(record: ProjectMilestoneRecord): ProjectMilestone {
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? "",
    dueDate: record.due_date ?? "",
    status: record.status,
    sortOrder: record.sort_order,
    completedAt: record.completed_at,
  };
}

export function buildProjectDetail(
  record: ProjectDetailRecord,
  milestones: ProjectMilestoneRecord[],
  tasks: ProjectTaskRecord[],
  deliverables: ProjectDeliverableRecord[],
  enquiry: ProjectEnquiryRecord | null,
  booking: ProjectBookingRecord | null,
  activity: ProjectActivityRecord[],
  now = new Date(),
): ProjectDetail {
  const listItem = shapeProjectRows(
    [{ ...record, project_tasks: tasks, project_deliverables: deliverables }],
    new Map([[record.id, activity]]),
    now,
  )[0]!;
  return {
    ...listItem,
    scheduleNotes: record.timeline ?? "",
    peopleResources: record.people_resources ?? "",
    budgetMin: optionalNumber(record.budget_min),
    budgetMax: optionalNumber(record.budget_max),
    currency: record.currency,
    milestones: milestones
      .map(shapeProjectMilestone)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    tasks: tasks
      .map(shapeProjectTask)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    deliverables: deliverables
      .map(shapeProjectDeliverable)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    activity: activity.map((entry) => shapeProjectActivity(entry, now)),
    enquiry: enquiry
      ? { id: enquiry.id, status: enquiry.status, projectType: enquiry.project_type }
      : null,
    booking: booking
      ? {
          id: booking.id,
          date: booking.date,
          location: booking.location ?? "",
          status: booking.status,
          deposit: booking.deposit,
        }
      : null,
  };
}

export function projectDetailToInput(project: ProjectDetail): ProjectInput {
  return {
    name: project.name,
    clientId: project.clientId,
    clientContactId: project.contact?.id ?? "",
    projectType: project.projectType,
    services: project.services,
    overview: project.overview,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    scheduleNotes: project.scheduleNotes,
    peopleResources: project.peopleResources,
    budgetMin: project.budgetMin === null ? "" : String(project.budgetMin),
    budgetMax: project.budgetMax === null ? "" : String(project.budgetMax),
    currency: project.currency,
    paymentStatus: project.paymentStatus,
    deliveryStatus: project.deliveryStatus,
    status: project.status,
    milestones: project.milestones.map(({ id, title, description, dueDate, status }) => ({
      id,
      title,
      description,
      dueDate,
      status,
    })),
    tasks: project.tasks.map(({ id, title, dueDate, isCompleted }) => ({
      id,
      title,
      dueDate,
      isCompleted,
    })),
    deliverables: project.deliverables.map(({ id, title, dueDate, status }) => ({
      id,
      title,
      dueDate,
      status,
    })),
  };
}

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
