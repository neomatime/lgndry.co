import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };

const projectResult: Result = { data: null, error: null };
const milestonesResult: Result = { data: [], error: null };
const tasksResult: Result = { data: [], error: null };
const deliverablesResult: Result = { data: [], error: null };
const activityResult: Result = { data: [], error: null };
const enquiryResult: Result = { data: null, error: null };
const bookingResult: Result = { data: null, error: null };
const fromMock = vi.fn();

function detailResult(result: Result) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(result)) })),
    })),
  };
}

function orderedResult(result: Result) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(result)) })),
    })),
  };
}

fromMock.mockImplementation((table: string) => {
  if (table === "projects") return detailResult(projectResult);
  if (table === "project_milestones") return orderedResult(milestonesResult);
  if (table === "project_tasks") return orderedResult(tasksResult);
  if (table === "project_deliverables") return orderedResult(deliverablesResult);
  if (table === "ops_activity_log") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(activityResult)) })),
        })),
      })),
    };
  }
  if (table === "enquiries") return detailResult(enquiryResult);
  if (table === "bookings") return detailResult(bookingResult);
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const baseProject = {
  id: PROJECT_ID,
  name: "Autumn Campaign",
  client: "22222222-2222-4222-8222-222222222222",
  client_contact_id: "33333333-3333-4333-8333-333333333333",
  project_type: "Documentary",
  services: ["Photography", "Film"],
  brief: "A quiet portrait of place.",
  location: "Limpopo",
  start_date: "2026-10-01",
  end_date: "2026-10-03",
  timeline: "Golden-hour exterior work.",
  people_resources: "Director, photographer",
  budget_min: "12000.00",
  budget_max: 18000,
  currency: "ZAR",
  status: "Planning",
  stage_position: 0,
  payment_status: "Deposit Pending",
  delivery_status: "Not Ready",
  archived: false,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-20T08:00:00Z",
  enquiry_id: "44444444-4444-4444-8444-444444444444",
  booking: "55555555-5555-4555-8555-555555555555",
  client_record: { id: "22222222-2222-4222-8222-222222222222", name: "Blackridge" },
  contact_record: {
    id: "33333333-3333-4333-8333-333333333333",
    full_name: "Thandi Mokoena",
    email: "thandi@example.com",
    phone: "0761234567",
    is_primary: true,
  },
  project_tasks: null,
  project_deliverables: null,
};

beforeEach(() => {
  for (const result of [
    projectResult,
    milestonesResult,
    tasksResult,
    deliverablesResult,
    activityResult,
    enquiryResult,
    bookingResult,
  ]) {
    result.data = null;
    result.error = null;
  }
  milestonesResult.data = [];
  tasksResult.data = [];
  deliverablesResult.data = [];
  activityResult.data = [];
  vi.clearAllMocks();
});

describe("fetchProjectDetail", () => {
  it("loads a complete project with linked enquiry and booking", async () => {
    projectResult.data = baseProject;
    milestonesResult.data = [
      {
        id: "milestone-1",
        title: "Treatment approved",
        description: null,
        due_date: null,
        status: "Completed",
        sort_order: 0,
        completed_at: "2026-09-20T08:00:00Z",
      },
    ];
    tasksResult.data = [
      {
        id: "task-1",
        title: "Confirm access",
        due_date: "2026-10-01",
        is_completed: false,
        sort_order: 0,
        completed_at: null,
      },
    ];
    deliverablesResult.data = [
      {
        id: "deliverable-1",
        title: "Hero film",
        due_date: "2026-10-10",
        status: "In Progress",
        sort_order: 0,
        completed_at: null,
      },
    ];
    activityResult.data = [
      {
        id: "activity-1",
        message: "Project created",
        action: "created",
        created_at: "2026-09-20T08:00:00Z",
      },
    ];
    enquiryResult.data = { id: baseProject.enquiry_id, status: "Booked", project_type: "Film" };
    bookingResult.data = {
      id: baseProject.booking,
      date: "2026-10-01",
      location: "Limpopo",
      status: "Confirmed",
      deposit: "Paid",
    };

    const { fetchProjectDetail } = await import("@/features/projects/fetch-project-detail");
    const result = await fetchProjectDetail(PROJECT_ID);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.project).toMatchObject({
        name: "Autumn Campaign",
        budgetMin: 12000,
        budgetMax: 18000,
        milestones: [{ title: "Treatment approved", description: "" }],
        tasks: [{ title: "Confirm access" }],
        deliverables: [{ title: "Hero film", status: "In Progress" }],
        enquiry: { status: "Booked" },
        booking: { date: "2026-10-01", deposit: "Paid" },
      });
    }
    expect(fromMock).toHaveBeenCalledTimes(7);
  });

  it("returns an archived project with empty optional relations", async () => {
    projectResult.data = {
      ...baseProject,
      id: "22222222-2222-4222-8222-222222222222",
      archived: true,
      enquiry_id: null,
      booking: null,
      contact_record: null,
    };

    const { fetchProjectDetail } = await import("@/features/projects/fetch-project-detail");
    const result = await fetchProjectDetail("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.project.archived).toBe(true);
      expect(result.project.contact).toBeNull();
      expect(result.project.enquiry).toBeNull();
      expect(result.project.booking).toBeNull();
    }
    expect(fromMock).toHaveBeenCalledTimes(5);
  });

  it("returns not-found for malformed and missing ids", async () => {
    const { fetchProjectDetail } = await import("@/features/projects/fetch-project-detail");
    expect(await fetchProjectDetail("not-a-real-id")).toEqual({ status: "not-found" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(await fetchProjectDetail("33333333-3333-4333-8333-333333333333")).toEqual({
      status: "not-found",
    });
  });

  it.each([
    ["project", projectResult],
    ["milestones", milestonesResult],
    ["tasks", tasksResult],
    ["deliverables", deliverablesResult],
    ["activity", activityResult],
    ["enquiry", enquiryResult],
    ["booking", bookingResult],
  ])("returns error when the %s query fails", async (_label, failedResult) => {
    projectResult.data = baseProject;
    failedResult.error = { message: "connection refused" };
    const ids: Record<string, string> = {
      project: "40000000-0000-4000-8000-000000000001",
      milestones: "40000000-0000-4000-8000-000000000002",
      tasks: "40000000-0000-4000-8000-000000000003",
      deliverables: "40000000-0000-4000-8000-000000000004",
      activity: "40000000-0000-4000-8000-000000000005",
      enquiry: "40000000-0000-4000-8000-000000000006",
      booking: "40000000-0000-4000-8000-000000000007",
    };
    const { fetchProjectDetail } = await import("@/features/projects/fetch-project-detail");
    expect(await fetchProjectDetail(ids[_label]!)).toEqual({ status: "error" });
  });
});
