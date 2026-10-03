import type { RelatedFollowUps } from "@/features/follow-ups/related-view-model";

export const ACTIVE_PROJECT_STAGES = [
  "Planning",
  "Pre-Production",
  "Production",
  "Review",
  "Delivery",
] as const;

export const PROJECT_OUTCOMES = ["Completed", "On Hold", "Cancelled"] as const;
export const PROJECT_STATUSES = [...ACTIVE_PROJECT_STAGES, ...PROJECT_OUTCOMES] as const;
export const PROJECT_TYPES = [
  "Documentary",
  "Event",
  "Film",
  "Visual Production",
  "Other",
] as const;
export const PAYMENT_STATUSES = [
  "Not Invoiced",
  "Deposit Pending",
  "Partially Paid",
  "Paid",
] as const;
export const DELIVERY_STATUSES = ["Not Ready", "Ready for Delivery", "Delivered"] as const;
export const DELIVERABLE_STATUSES = ["Not Started", "In Progress", "Ready", "Delivered"] as const;

export type ActiveProjectStage = (typeof ACTIVE_PROJECT_STAGES)[number];
export type ProjectOutcome = (typeof PROJECT_OUTCOMES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectType = (typeof PROJECT_TYPES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export type MilestoneStatus = "Pending" | "Completed";

export type ProjectMilestoneInput = {
  id?: string;
  title: string;
  description: string;
  dueDate: string;
  status: MilestoneStatus;
};

export type ProjectTaskInput = {
  id?: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
};

export type ProjectDeliverableInput = {
  id?: string;
  title: string;
  dueDate: string;
  status: DeliverableStatus;
};

export type ProjectInput = {
  name: string;
  clientId: string;
  clientContactId: string;
  projectType: ProjectType;
  services: string[];
  overview: string;
  location: string;
  startDate: string;
  endDate: string;
  scheduleNotes: string;
  peopleResources: string;
  budgetMin: string;
  budgetMax: string;
  currency: string;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  status: ProjectStatus;
  milestones: ProjectMilestoneInput[];
  tasks: ProjectTaskInput[];
  deliverables: ProjectDeliverableInput[];
};

export type ProjectContact = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type ProjectClientOption = {
  id: string;
  name: string;
  contacts: ProjectContact[];
};

export type ProjectActivity = {
  id: string;
  message: string;
  action: string | null;
  createdAt: string;
  relativeTime: string;
};

export type ProjectMilestone = ProjectMilestoneInput & {
  id: string;
  sortOrder: number;
  completedAt: string | null;
};

export type ProjectTask = ProjectTaskInput & {
  id: string;
  sortOrder: number;
  completedAt: string | null;
};

export type ProjectDeliverable = ProjectDeliverableInput & {
  id: string;
  sortOrder: number;
  completedAt: string | null;
};

export type ProjectListItem = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  contact: ProjectContact | null;
  projectType: ProjectType;
  services: string[];
  overview: string;
  location: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  stagePosition: number;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  enquiryId: string | null;
  bookingId: string | null;
  tasks: ProjectTask[];
  deliverables: ProjectDeliverable[];
  activity: ProjectActivity[];
};

export type ProjectDetail = ProjectListItem & {
  scheduleNotes: string;
  peopleResources: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  /** The project's client is archived: the follow-up form can't pre-fill an archived client. */
  clientArchived: boolean;
  followUps: RelatedFollowUps;
  milestones: ProjectMilestone[];
  enquiry: { id: string; status: string; projectType: string } | null;
  booking: {
    id: string;
    date: string | null;
    location: string;
    status: string;
    deposit: string;
  } | null;
};

export type ProjectActionState =
  | { status: "idle" }
  | { status: "success"; projectId: string }
  | { status: "not-found"; message: string }
  | { status: "conflict"; message: string; projectId: string }
  | { status: "invalid"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "error"; message: string };
