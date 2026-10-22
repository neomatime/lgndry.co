import { relativeTime } from "@/features/enquiries/relative-time";
import { addDays, johannesburgDate } from "@/features/follow-ups/list-view-model";
import { ACTIVE_PROJECT_STAGES } from "@/features/projects/types";
import type {
  DashboardActiveRecord,
  DashboardActivityRecord,
  DashboardAttentionItem,
  DashboardFollowUpItem,
  DashboardSourceData,
  DashboardViewModel,
} from "@/features/dashboard/types";

const ACTIVE_PROJECT_STATUS = new Set<string>(ACTIVE_PROJECT_STAGES);

function shortDate(value: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00+02:00`));
}

function dashboardDate(now: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);
}

function shortSummary(value: string, limit = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

export function dashboardGreeting(name: string, now: Date) {
  const hourPart = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? 12);
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const preferredName = name.trim().split(/\s+/)[0] || "Admin";
  return `Good ${timeOfDay}, ${preferredName}`;
}

function dueLabel(date: string, today: string) {
  if (!date) return "No date";
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date < today) return "Overdue";
  return shortDate(date);
}

function activityHref(activity: DashboardActivityRecord) {
  if (activity.collection === "email_threads") return "/ops/inbox";
  if (!activity.recordId) return null;
  const routes: Record<string, string> = {
    clients: "clients",
    enquiries: "enquiries",
    projects: "projects",
    follow_ups: "follow-ups",
    commercial_invoices: "invoices",
    commercial_quotes: "invoices/quotes",
  };
  const route = activity.collection ? routes[activity.collection] : undefined;
  return route ? `/ops/${route}/${activity.recordId}` : null;
}

function buildAttention(data: DashboardSourceData, today: string) {
  const items: DashboardAttentionItem[] = [];

  for (const row of data.followUps) {
    if (row.scheduleState !== "Overdue" && row.scheduleState !== "Today") continue;
    items.push({
      id: `follow-up-${row.id}`,
      kind: "Follow-up",
      clientName: row.clientName,
      service: row.related?.label ?? row.displayType,
      currentStage: row.displayType,
      nextAction: row.title,
      dueLabel: dueLabel(row.dueDate, today),
      status: row.scheduleState === "Today" ? "Due Today" : "Overdue",
      href: `/ops/follow-ups/${row.id}`,
      urgency: row.scheduleState === "Overdue" ? 0 : 1,
      dueSort: `${row.dueDate}T${row.dueTime || "23:59"}`,
    });
  }

  for (const row of data.invoices) {
    if (row.outstanding <= 0 || row.status === "Draft" || row.status === "Void") continue;
    const overdue = row.displayStatus === "Overdue";
    items.push({
      id: `invoice-${row.id}`,
      kind: "Invoice",
      clientName: row.clientName,
      service: row.projectName ?? row.title,
      currentStage: row.billingType,
      nextAction: overdue ? "Follow up on outstanding payment" : "Await client payment",
      dueLabel: dueLabel(row.dueDate, today),
      status: row.displayStatus,
      href: `/ops/invoices/${row.id}`,
      urgency: overdue ? 0 : row.dueDate === today ? 1 : 4,
      dueSort: row.dueDate || "9999-12-31",
    });
  }

  for (const row of data.quotes) {
    if (row.status !== "Sent") continue;
    items.push({
      id: `quote-${row.id}`,
      kind: "Quote",
      clientName: row.clientName,
      service: row.title,
      currentStage: "Quote Sent",
      nextAction: "Await client approval",
      dueLabel: dueLabel(row.validUntil, today),
      status: "Awaiting Approval",
      href: `/ops/invoices/quotes/${row.id}`,
      urgency: row.validUntil && row.validUntil < today ? 0 : 3,
      dueSort: row.validUntil || "9999-12-31",
    });
  }

  for (const row of data.enquiries) {
    if (row.status === "Completed" || row.status === "Closed") continue;
    if (row.status !== "New" && row.attachmentCount > 0) continue;
    const missingAttachments = row.attachmentCount === 0;
    items.push({
      id: `enquiry-${row.id}`,
      kind: "Enquiry",
      clientName: row.company || row.fullName,
      service: row.projectType,
      currentStage: row.status,
      nextAction: missingAttachments ? "Request missing attachments" : "Review project brief",
      dueLabel: "Open",
      status: missingAttachments ? "Needs Attention" : "New",
      href: `/ops/enquiries/${row.id}`,
      urgency: row.status === "New" ? 2 : 3,
      dueSort: row.createdAt,
    });
  }

  for (const row of data.projects) {
    if (row.archived || !ACTIVE_PROJECT_STATUS.has(row.status)) continue;
    const overdueTask = row.tasks
      .filter((task) => !task.isCompleted && task.dueDate && task.dueDate < today)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
    if (!overdueTask && row.deliveryStatus !== "Ready for Delivery") continue;
    items.push({
      id: `project-${row.id}`,
      kind: "Project",
      clientName: row.clientName,
      service: row.name,
      currentStage: row.status,
      nextAction: overdueTask?.title ?? "Confirm final asset delivery",
      dueLabel: overdueTask ? "Overdue" : "Ready",
      status: overdueTask ? "Needs Attention" : "Client Confirmation",
      href: `/ops/projects/${row.id}`,
      urgency: overdueTask ? 0 : 3,
      dueSort: overdueTask?.dueDate ?? row.endDate ?? "9999-12-31",
    });
  }

  return items.sort(
    (left, right) =>
      left.urgency - right.urgency ||
      left.dueSort.localeCompare(right.dueSort) ||
      left.clientName.localeCompare(right.clientName),
  );
}

function buildActiveRecord(data: DashboardSourceData, today: string): DashboardActiveRecord | null {
  const project = [...data.projects]
    .filter((row) => !row.archived && ACTIVE_PROJECT_STATUS.has(row.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (!project) return null;
  const enquiry = data.enquiries.find((row) => row.id === project.enquiryId);
  const quote = [...data.quotes]
    .filter((row) => row.clientId === project.clientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const nextFollowUp = [...data.followUps]
    .filter(
      (row) =>
        row.status === "Open" &&
        (row.related?.id === project.id || row.clientId === project.clientId),
    )
    .sort((left, right) =>
      `${left.dueDate}T${left.dueTime || "23:59"}`.localeCompare(
        `${right.dueDate}T${right.dueTime || "23:59"}`,
      ),
    )[0];
  return {
    id: project.id,
    clientName: project.clientName,
    projectName: project.name,
    href: `/ops/projects/${project.id}`,
    enquiryDate: enquiry ? shortDate(enquiry.createdAt) : "Not linked",
    services: project.services.join(", ") || project.projectType,
    attachments: enquiry?.attachmentCount ?? 0,
    quoteStatus: quote?.status ?? "No quote",
    bookingStatus: project.bookingId ? "Booked" : "Not booked",
    paymentStatus: project.paymentStatus,
    projectStatus: project.status,
    nextFollowUp: nextFollowUp ? dueLabel(nextFollowUp.dueDate, today) : "None scheduled",
    notes: shortSummary(project.overview || "No project notes have been added yet."),
  };
}

function buildUpcomingFollowUps(data: DashboardSourceData, today: string): DashboardFollowUpItem[] {
  return [...data.followUps]
    .filter((row) => row.status === "Open" && row.dueDate >= today)
    .sort((left, right) =>
      `${left.dueDate}T${left.dueTime || "23:59"}`.localeCompare(
        `${right.dueDate}T${right.dueTime || "23:59"}`,
      ),
    )
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      clientName: row.clientName,
      title: row.title,
      date: row.dueDate,
      dateLabel: shortDate(row.dueDate),
      dueLabel: dueLabel(row.dueDate, today),
      href: `/ops/follow-ups/${row.id}`,
    }));
}

export function buildDashboardViewModel(
  data: DashboardSourceData,
  now = new Date(),
): DashboardViewModel {
  const today = johannesburgDate(now);
  const activeProjects = data.projects.filter(
    (row) => !row.archived && ACTIVE_PROJECT_STATUS.has(row.status),
  );
  const dueFollowUps = data.followUps.filter(
    (row) => row.scheduleState === "Overdue" || row.scheduleState === "Today",
  );
  const outstandingInvoices = data.invoices.filter(
    (row) => row.outstanding > 0 && row.status !== "Draft" && row.status !== "Void",
  );
  const attention = buildAttention(data, today);
  const currentClients = data.clients.filter((row) => !row.archived);

  return {
    dateLabel: dashboardDate(now),
    metrics: {
      newEnquiries: data.enquiries.filter((row) => row.status === "New").length,
      activeProjects: activeProjects.length,
      dueFollowUps: dueFollowUps.length,
      overdueFollowUps: dueFollowUps.filter((row) => row.scheduleState === "Overdue").length,
      outstandingInvoices: outstandingInvoices.length,
      outstandingTotal: outstandingInvoices.reduce((sum, row) => sum + row.outstanding, 0),
    },
    attention: attention.slice(0, 5),
    attentionTotal: attention.length,
    pipeline: [
      { label: "Client", value: currentClients.length, href: "/ops/clients" },
      {
        label: "Enquiry",
        value: data.enquiries.filter((row) => row.status !== "Closed").length,
        href: "/ops/enquiries",
      },
      {
        label: "Attachments",
        value: data.enquiries.reduce((sum, row) => sum + row.attachmentCount, 0),
        href: "/ops/enquiries",
      },
      { label: "Communication", value: data.communicationCount, href: "/ops/inbox" },
      {
        label: "Quote",
        value: data.quotes.filter((row) => row.status !== "Void" && row.status !== "Superseded")
          .length,
        href: "/ops/invoices/quotes",
      },
      {
        label: "Booking",
        value: data.projects.filter((row) => Boolean(row.bookingId)).length,
        href: "/ops/projects",
      },
      {
        label: "Payment",
        value: data.invoices.filter((row) => row.paidAmount > 0).length,
        href: "/ops/invoices",
      },
      { label: "Project", value: activeProjects.length, href: "/ops/projects" },
      {
        label: "Production",
        value: activeProjects.filter((row) => row.status === "Production").length,
        href: "/ops/projects",
      },
      {
        label: "Delivery",
        value: data.projects.filter(
          (row) => row.status === "Delivery" || row.deliveryStatus !== "Not Ready",
        ).length,
        href: "/ops/projects",
      },
      {
        label: "Follow-up",
        value: data.followUps.filter((row) => row.status === "Open").length,
        href: "/ops/follow-ups",
      },
    ],
    activeRecord: buildActiveRecord(data, today),
    upcomingFollowUps: buildUpcomingFollowUps(data, today),
    activity: data.activity.slice(0, 6).map((row) => ({
      ...row,
      relativeTime: relativeTime(row.createdAt, now),
      href: activityHref(row),
    })),
  };
}

export function formatDashboardMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}
