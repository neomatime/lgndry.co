import { relativeTime } from "@/features/enquiries/relative-time";
import type {
  FollowUpActivity,
  FollowUpContactMethod,
  FollowUpListItem,
  FollowUpPriority,
  FollowUpScheduleState,
  FollowUpStatus,
  FollowUpType,
} from "@/features/follow-ups/types";

export type FollowUpRecord = {
  id: string;
  reference_number: number | string;
  client_id: string;
  contact_id: string | null;
  enquiry_id: string | null;
  project_id: string | null;
  follow_up_type: FollowUpType;
  custom_type: string | null;
  title: string;
  overview: string | null;
  notes: string | null;
  due_date: string;
  due_time: string | null;
  priority: FollowUpPriority;
  contact_methods: FollowUpContactMethod[];
  status: FollowUpStatus;
  outcome: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  owner_user_id: string | null;
  owner_name: string;
  owner_email: string;
  series_id: string | null;
  occurrence_number: number;
  successor_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  client_record: { id: string; name: string | null } | null;
  contact_record: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role_title: string | null;
  } | null;
  enquiry_record: { id: string; project_type: string } | null;
  project_record: { id: string; name: string } | null;
  follow_up_checklist_items: Array<{
    id: string;
    label: string;
    sort_order: number;
    is_completed: boolean;
    completed_at: string | null;
    version: number;
  }> | null;
};

export type FollowUpActivityRecord = {
  id: string;
  message: string;
  action: string | null;
  created_at: string;
};
export type FollowUpView = "All" | "Overdue" | "Today" | "Upcoming" | "Completed" | "Cancelled";
export type FollowUpSort = "due-soonest" | "due-latest" | "newest" | "oldest" | "priority";
export type FollowUpFilters = {
  view: FollowUpView;
  search: string;
  clientId?: string;
  type?: FollowUpType;
  priority?: FollowUpPriority;
  contactMethod?: FollowUpContactMethod;
  ownerId?: string;
};

function johannesburgParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** Today's calendar date (`YYYY-MM-DD`) in Johannesburg, never the runtime's zone. */
export function johannesburgDate(now: Date) {
  return johannesburgParts(now).date;
}

/** Adds whole days to a `YYYY-MM-DD` calendar date. Pure date maths, no time zone involved. */
export function addDays(date: string, days: number) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Monday to Sunday calendar week containing `now` in Johannesburg. */
export function johannesburgWeek(now: Date) {
  const today = johannesburgDate(now);
  const [year = 1970, month = 1, day = 1] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const start = addDays(today, -((weekday + 6) % 7));
  return { start, end: addDays(start, 6) };
}

export function getScheduleState(
  status: FollowUpStatus,
  dueDate: string,
  dueTime: string,
  now = new Date(),
): FollowUpScheduleState {
  if (status === "Completed") return "Completed";
  if (status === "Cancelled") return "Cancelled";
  const local = johannesburgParts(now);
  if (
    dueDate < local.date ||
    (dueDate === local.date && dueTime && dueTime.slice(0, 5) < local.time)
  )
    return "Overdue";
  if (dueDate === local.date) return "Today";
  return "Upcoming";
}

export function shapeFollowUp(record: FollowUpRecord, now = new Date()): FollowUpListItem {
  const dueTime = record.due_time?.slice(0, 5) ?? "";
  const related = record.enquiry_record
    ? {
        id: record.enquiry_record.id,
        label: record.enquiry_record.project_type,
        kind: "Enquiry" as const,
      }
    : record.project_record
      ? {
          id: record.project_record.id,
          label: record.project_record.name,
          kind: "Project" as const,
        }
      : null;
  return {
    id: record.id,
    reference: `FUP-${String(record.reference_number).padStart(4, "0")}`,
    clientId: record.client_id,
    clientName: record.client_record?.name ?? "Unnamed client",
    contact: record.contact_record
      ? {
          id: record.contact_record.id,
          fullName: record.contact_record.full_name,
          email: record.contact_record.email,
          phone: record.contact_record.phone ?? "",
          role: record.contact_record.role_title ?? "",
        }
      : null,
    related,
    followUpType: record.follow_up_type,
    customType: record.custom_type ?? "",
    displayType: record.custom_type ?? record.follow_up_type,
    title: record.title,
    overview: record.overview ?? "",
    notes: record.notes ?? "",
    dueDate: record.due_date,
    dueTime,
    priority: record.priority,
    contactMethods: record.contact_methods,
    status: record.status,
    scheduleState: getScheduleState(record.status, record.due_date, dueTime, now),
    outcome: record.outcome ?? "",
    cancellationReason: record.cancellation_reason ?? "",
    completedAt: record.completed_at,
    cancelledAt: record.cancelled_at,
    owner: { id: record.owner_user_id, name: record.owner_name, email: record.owner_email },
    seriesId: record.series_id,
    occurrenceNumber: record.occurrence_number,
    successorId: record.successor_id,
    version: record.version,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    checklist: (record.follow_up_checklist_items ?? [])
      .map((item) => ({
        id: item.id,
        label: item.label,
        sortOrder: item.sort_order,
        isCompleted: item.is_completed,
        completedAt: item.completed_at,
        version: item.version,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/**
 * Re-evaluates every row's scheduling state against one `now`, so metrics, tabs and
 * labels all agree even when the rows were shaped a moment before they are shown.
 */
export function withScheduleStates(rows: FollowUpListItem[], now: Date): FollowUpListItem[] {
  return rows.map((row) => ({
    ...row,
    scheduleState: getScheduleState(row.status, row.dueDate, row.dueTime, now),
  }));
}

const OPEN_STATES: ReadonlySet<FollowUpScheduleState> = new Set(["Overdue", "Today", "Upcoming"]);

export function summarizeFollowUps(rows: FollowUpListItem[], now = new Date()) {
  const week = johannesburgWeek(now);
  const completedInWeek = (completedAt: string | null) => {
    if (!completedAt) return false;
    const completed = new Date(completedAt);
    if (Number.isNaN(completed.getTime())) return false;
    const day = johannesburgDate(completed);
    return day >= week.start && day <= week.end;
  };
  return {
    overdue: rows.filter((row) => row.scheduleState === "Overdue").length,
    dueToday: rows.filter((row) => row.scheduleState === "Today").length,
    upcoming: rows.filter((row) => row.scheduleState === "Upcoming").length,
    completed: rows.filter((row) => row.scheduleState === "Completed").length,
    // Open follow-ups whose due date falls in the current Monday-Sunday week. Overdue ones
    // from earlier this week are included: this is a literal "due this week".
    dueThisWeek: rows.filter(
      (row) =>
        OPEN_STATES.has(row.scheduleState) && row.dueDate >= week.start && row.dueDate <= week.end,
    ).length,
    completedThisWeek: rows.filter(
      (row) => row.scheduleState === "Completed" && completedInWeek(row.completedAt),
    ).length,
  };
}

export function filterFollowUps(rows: FollowUpListItem[], filters: FollowUpFilters) {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.view !== "All" && row.scheduleState !== filters.view) return false;
    if (filters.clientId && row.clientId !== filters.clientId) return false;
    if (filters.type && row.followUpType !== filters.type) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.contactMethod && !row.contactMethods.includes(filters.contactMethod)) return false;
    if (filters.ownerId && row.owner.id !== filters.ownerId) return false;
    if (!query) return true;
    return [
      row.reference,
      row.title,
      row.clientName,
      row.contact?.fullName ?? "",
      row.displayType,
      row.related?.label ?? "",
      row.owner.name,
    ].some((value) => value.toLowerCase().includes(query));
  });
}

const priorityOrder: Record<FollowUpPriority, number> = { High: 0, Medium: 1, Low: 2 };
export function sortFollowUps(rows: FollowUpListItem[], sort: FollowUpSort) {
  return [...rows].sort((a, b) => {
    if (sort === "priority")
      return (
        priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueDate.localeCompare(b.dueDate)
      );
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    const delta = `${a.dueDate}T${a.dueTime || "23:59"}`.localeCompare(
      `${b.dueDate}T${b.dueTime || "23:59"}`,
    );
    return sort === "due-latest" ? -delta : delta;
  });
}

export function shapeFollowUpActivity(
  record: FollowUpActivityRecord,
  now = new Date(),
): FollowUpActivity {
  return {
    id: record.id,
    message: record.message,
    action: record.action,
    createdAt: record.created_at,
    relativeTime: relativeTime(record.created_at, now),
  };
}

export function checklistProgress(item: Pick<FollowUpListItem, "checklist">) {
  const total = item.checklist.length;
  const completed = item.checklist.filter((entry) => entry.isCompleted).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}
