import { describe, expect, it } from "vitest";
import type { DashboardSourceData } from "@/features/dashboard/types";
import {
  buildDashboardViewModel,
  dashboardGreeting,
  formatDashboardMoney,
} from "@/features/dashboard/view-model";

const NOW = new Date("2026-10-22T08:00:00+02:00");

describe("dashboardGreeting", () => {
  it.each([
    ["2026-10-22T07:00:00+02:00", "Good morning, Neo"],
    ["2026-10-22T13:00:00+02:00", "Good afternoon, Neo"],
    ["2026-10-22T19:00:00+02:00", "Good evening, Neo"],
  ])("uses Johannesburg time for %s", (date, expected) => {
    expect(dashboardGreeting("Neo Matime", new Date(date))).toBe(expected);
  });
});

function source(overrides: Partial<DashboardSourceData> = {}): DashboardSourceData {
  return {
    enquiries: [],
    projects: [],
    clients: [],
    followUps: [],
    invoices: [],
    quotes: [],
    communicationCount: 0,
    activity: [],
    ...overrides,
  };
}

describe("buildDashboardViewModel", () => {
  it("builds truthful metrics and puts overdue work first", () => {
    const data = source({
      enquiries: [
        {
          id: "enquiry-1",
          status: "New",
          company: "Northshore Media",
          fullName: "Nia Ndlovu",
          projectType: "Brand Film",
          attachmentCount: 0,
          createdAt: "2026-10-21T08:00:00Z",
        } as DashboardSourceData["enquiries"][number],
      ],
      projects: [
        {
          id: "project-1",
          clientId: "client-1",
          clientName: "Northshore Media",
          name: "Spring Film",
          status: "Production",
          archived: false,
          deliveryStatus: "Not Ready",
          paymentStatus: "Deposit Pending",
          bookingId: "booking-1",
          updatedAt: "2026-10-22T06:00:00Z",
          services: ["Film"],
          projectType: "Film",
          tasks: [],
          deliverables: [],
          overview: "A spring brand film.",
          enquiryId: "enquiry-1",
        } as unknown as DashboardSourceData["projects"][number],
      ],
      followUps: [
        {
          id: "follow-up-1",
          clientId: "client-1",
          clientName: "Northshore Media",
          status: "Open",
          scheduleState: "Overdue",
          dueDate: "2026-10-21",
          dueTime: "10:00",
          title: "Confirm deposit",
          displayType: "Deposit Reminder",
          related: { id: "project-1", label: "Spring Film", kind: "Project" },
        } as DashboardSourceData["followUps"][number],
      ],
      invoices: [
        {
          id: "invoice-1",
          clientName: "Northshore Media",
          projectName: "Spring Film",
          title: "Spring Film deposit",
          status: "Sent",
          displayStatus: "Open",
          billingType: "Deposit",
          dueDate: "2026-10-23",
          outstanding: 12_500,
          paidAmount: 0,
        } as DashboardSourceData["invoices"][number],
      ],
    });

    const dashboard = buildDashboardViewModel(data, NOW);

    expect(dashboard.metrics).toMatchObject({
      newEnquiries: 1,
      activeProjects: 1,
      dueFollowUps: 1,
      overdueFollowUps: 1,
      outstandingInvoices: 1,
      outstandingTotal: 12_500,
    });
    expect(dashboard.attention[0]).toMatchObject({
      kind: "Follow-up",
      status: "Overdue",
      nextAction: "Confirm deposit",
    });
    expect(dashboard.attentionTotal).toBe(3);
  });

  it("shapes the pipeline, active project, upcoming schedule and linked activity", () => {
    const data = source({
      communicationCount: 4,
      clients: [{ id: "client-1", archived: false } as DashboardSourceData["clients"][number]],
      enquiries: [
        {
          id: "enquiry-1",
          status: "Reviewing",
          attachmentCount: 2,
          createdAt: "2026-10-20T08:00:00Z",
        } as DashboardSourceData["enquiries"][number],
      ],
      projects: [
        {
          id: "project-1",
          clientId: "client-1",
          clientName: "Lumen Partners",
          name: "Global Brand Film",
          status: "Planning",
          archived: false,
          deliveryStatus: "Not Ready",
          paymentStatus: "Not Invoiced",
          bookingId: null,
          updatedAt: "2026-10-22T06:00:00Z",
          services: ["Film", "Aerial"],
          projectType: "Film",
          tasks: [],
          deliverables: [],
          overview: "Launch campaign.",
          enquiryId: "enquiry-1",
        } as unknown as DashboardSourceData["projects"][number],
      ],
      followUps: [
        {
          id: "follow-up-1",
          clientId: "client-1",
          clientName: "Lumen Partners",
          status: "Open",
          scheduleState: "Upcoming",
          dueDate: "2026-10-23",
          dueTime: "09:00",
          title: "Review revised brief",
          displayType: "Proposal Review",
          related: { id: "project-1", label: "Global Brand Film", kind: "Project" },
        } as DashboardSourceData["followUps"][number],
      ],
      quotes: [
        {
          id: "quote-1",
          clientId: "client-1",
          clientName: "Lumen Partners",
          status: "Approved",
          createdAt: "2026-10-21T08:00:00Z",
        } as DashboardSourceData["quotes"][number],
      ],
      activity: [
        {
          id: "activity-1",
          collection: "projects",
          recordId: "project-1",
          message: "Project created",
          action: "created",
          createdAt: "2026-10-22T05:00:00Z",
        },
      ],
    });

    const dashboard = buildDashboardViewModel(data, NOW);

    expect(
      Object.fromEntries(dashboard.pipeline.map((item) => [item.label, item.value])),
    ).toMatchObject({
      Client: 1,
      Enquiry: 1,
      Attachments: 2,
      Communication: 4,
      Quote: 1,
      Project: 1,
      "Follow-up": 1,
    });
    expect(dashboard.activeRecord).toMatchObject({
      clientName: "Lumen Partners",
      projectName: "Global Brand Film",
      quoteStatus: "Approved",
      nextFollowUp: "Tomorrow",
    });
    expect(dashboard.upcomingFollowUps[0]).toMatchObject({ dueLabel: "Tomorrow" });
    expect(dashboard.activity[0]).toMatchObject({
      href: "/ops/projects/project-1",
      message: "Project created",
    });
  });

  it("keeps the empty dashboard useful and formats ZAR without invented cents", () => {
    const dashboard = buildDashboardViewModel(source(), NOW);
    expect(dashboard.activeRecord).toBeNull();
    expect(dashboard.attention).toEqual([]);
    expect(dashboard.pipeline).toHaveLength(11);
    expect(formatDashboardMoney(24_500)).toContain("24\u00a0500");
  });

  it("keeps the active-record note concise", () => {
    const dashboard = buildDashboardViewModel(
      source({
        projects: [
          {
            id: "project-1",
            clientId: "client-1",
            clientName: "Kabelo Maepa",
            name: "Creative Session",
            status: "Planning",
            archived: false,
            deliveryStatus: "Not Ready",
            paymentStatus: "Not Invoiced",
            bookingId: null,
            updatedAt: "2026-10-22T06:00:00Z",
            services: ["Portraiture"],
            projectType: "Photography",
            tasks: [],
            deliverables: [],
            overview: "A very long project description ".repeat(12),
            enquiryId: null,
          } as unknown as DashboardSourceData["projects"][number],
        ],
      }),
      NOW,
    );
    expect(dashboard.activeRecord?.notes.length).toBeLessThanOrEqual(120);
    expect(dashboard.activeRecord?.notes).toMatch(/…$/);
  });
});
