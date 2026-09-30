export const FOLLOW_UP_TYPES = [
  "Client Check-in",
  "Quote Follow-up",
  "Proposal Review",
  "Deposit Reminder",
  "Approval",
  "Delivery Confirmation",
  "Other",
] as const;

export const FOLLOW_UP_PRIORITIES = ["Low", "Medium", "High"] as const;
export const FOLLOW_UP_CONTACT_METHODS = [
  "Email",
  "Phone",
  "WhatsApp",
  "Video Call",
  "In Person",
] as const;
export const FOLLOW_UP_STATUSES = ["Open", "Completed", "Cancelled"] as const;
export const RECURRENCE_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Custom"] as const;
export const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
] as const;

export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];
export type FollowUpPriority = (typeof FOLLOW_UP_PRIORITIES)[number];
export type FollowUpContactMethod = (typeof FOLLOW_UP_CONTACT_METHODS)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
export type FollowUpScheduleState = "Overdue" | "Today" | "Upcoming" | "Completed" | "Cancelled";
export type FollowUpEditScope = "occurrence" | "future";

export type FollowUpChecklistInput = { id?: string; label: string; sortOrder: number };
export type FollowUpRecurrenceInput = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  weekdays: number[];
  monthAnchor: number | null;
  endsOn: string;
  maxOccurrences: number | null;
};

export type FollowUpInput = {
  clientId: string;
  contactId: string;
  enquiryId: string;
  projectId: string;
  followUpType: FollowUpType;
  customType: string;
  title: string;
  overview: string;
  notes: string;
  dueDate: string;
  dueTime: string;
  priority: FollowUpPriority;
  contactMethods: FollowUpContactMethod[];
  checklist: FollowUpChecklistInput[];
  recurrence: FollowUpRecurrenceInput;
  editScope: FollowUpEditScope;
};

export type FollowUpOwner = { id: string | null; name: string; email: string };
export type FollowUpContact = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
};
export type FollowUpRelatedRecord = { id: string; label: string; kind: "Enquiry" | "Project" };
export type FollowUpChecklistItem = FollowUpChecklistInput & {
  id: string;
  isCompleted: boolean;
  completedAt: string | null;
  version: number;
};
export type FollowUpActivity = {
  id: string;
  message: string;
  action: string | null;
  createdAt: string;
  relativeTime: string;
};

export type FollowUpListItem = {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  contact: FollowUpContact | null;
  related: FollowUpRelatedRecord | null;
  followUpType: FollowUpType;
  customType: string;
  displayType: string;
  title: string;
  overview: string;
  notes: string;
  dueDate: string;
  dueTime: string;
  priority: FollowUpPriority;
  contactMethods: FollowUpContactMethod[];
  status: FollowUpStatus;
  scheduleState: FollowUpScheduleState;
  outcome: string;
  cancellationReason: string;
  completedAt: string | null;
  cancelledAt: string | null;
  owner: FollowUpOwner;
  seriesId: string | null;
  occurrenceNumber: number;
  successorId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  checklist: FollowUpChecklistItem[];
};

export type FollowUpSeries = {
  id: string;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  weekdays: number[];
  monthAnchor: number | null;
  recurrenceRule: string;
  endsOn: string;
  maxOccurrences: number | null;
  occurrencesCreated: number;
  active: boolean;
  version: number;
};

export type FollowUpDetail = FollowUpListItem & {
  series: FollowUpSeries | null;
  predecessorId: string | null;
  activity: FollowUpActivity[];
};

export type FollowUpClientOption = {
  id: string;
  name: string;
  contacts: FollowUpContact[];
  enquiries: { id: string; label: string }[];
  projects: { id: string; label: string }[];
};

export type FollowUpActionState =
  | { status: "idle" }
  | { status: "success"; followUpId: string; successorId?: string | null }
  | { status: "not-found"; message: string }
  | { status: "conflict"; message: string; successorId?: string }
  | { status: "invalid"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "error"; message: string };
