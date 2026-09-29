import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown[]; error: { message: string } | null };

const projectsResult: Result = { data: [], error: null };
const activityResult: Result = { data: [], error: null };
const projectsSelect = vi.fn();
const projectsStageOrder = vi.fn();
const projectsCreatedOrder = vi.fn(() => Promise.resolve(projectsResult));
const activitySelect = vi.fn();
const activityEq = vi.fn();
const activityOrder = vi.fn(() => Promise.resolve(activityResult));

const fromMock = vi.fn((table: string) => {
  if (table === "projects") {
    return {
      select: projectsSelect.mockImplementation(() => ({
        order: projectsStageOrder.mockImplementation(() => ({ order: projectsCreatedOrder })),
      })),
    };
  }
  if (table === "ops_activity_log") {
    return {
      select: activitySelect.mockImplementation(() => ({
        eq: activityEq.mockImplementation(() => ({ order: activityOrder })),
      })),
    };
  }
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
  services: ["Photography"],
  brief: "A quiet portrait of place.",
  location: "Limpopo",
  start_date: "2026-10-01",
  end_date: "2026-10-03",
  status: "Planning",
  stage_position: 1,
  payment_status: "Deposit Pending",
  delivery_status: "Not Ready",
  archived: false,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-20T08:00:00Z",
  enquiry_id: null,
  booking: null,
  client_record: { id: "22222222-2222-4222-8222-222222222222", name: "Blackridge" },
  contact_record: {
    id: "33333333-3333-4333-8333-333333333333",
    full_name: "Thandi Mokoena",
    email: "thandi@example.com",
    phone: null,
    is_primary: true,
  },
  project_tasks: [
    {
      id: "task-2",
      title: "Confirm access",
      due_date: "2026-10-01",
      is_completed: false,
      sort_order: 1,
      completed_at: null,
    },
    {
      id: "task-1",
      title: "Approve treatment",
      due_date: null,
      is_completed: true,
      sort_order: 0,
      completed_at: "2026-09-21T08:00:00Z",
    },
  ],
  project_deliverables: [],
};

beforeEach(() => {
  projectsResult.data = [];
  projectsResult.error = null;
  activityResult.data = [];
  activityResult.error = null;
  vi.clearAllMocks();
});

describe("fetchProjects", () => {
  it("loads and shapes production context with recent activity", async () => {
    projectsResult.data = [baseProject];
    activityResult.data = [
      {
        id: "activity-1",
        record_id: PROJECT_ID,
        message: "Project created",
        action: "created",
        created_at: "2026-09-20T08:00:00Z",
      },
    ];

    const { fetchProjects } = await import("@/features/projects/fetch-projects");
    const result = await fetchProjects();

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: "Autumn Campaign",
      clientName: "Blackridge",
      contact: { fullName: "Thandi Mokoena", phone: "" },
      tasks: [
        { title: "Approve treatment", sortOrder: 0 },
        { title: "Confirm access", sortOrder: 1 },
      ],
      activity: [{ message: "Project created", action: "created" }],
    });
    expect(projectsSelect).toHaveBeenCalledWith(expect.stringContaining("project_tasks"));
    expect(projectsSelect).toHaveBeenCalledWith(expect.stringContaining("client_record:clients"));
    expect(projectsStageOrder).toHaveBeenCalledWith("stage_position", { ascending: true });
    expect(activityEq).toHaveBeenCalledWith("collection", "projects");
  });

  it("supports empty client-contact, child, and activity relations", async () => {
    projectsResult.data = [
      {
        ...baseProject,
        client_record: null,
        contact_record: null,
        services: null,
        project_tasks: null,
        project_deliverables: null,
      },
    ];

    const { fetchProjects } = await import("@/features/projects/fetch-projects");
    const result = await fetchProjects();

    expect(result![0]).toMatchObject({
      clientName: "Unnamed client",
      contact: null,
      services: [],
      tasks: [],
      deliverables: [],
      activity: [],
    });
  });

  it.each([
    ["projects", projectsResult],
    ["activity", activityResult],
  ])("returns null when the %s query fails", async (_label, failedResult) => {
    failedResult.error = { message: "connection refused" };
    const { fetchProjects } = await import("@/features/projects/fetch-projects");
    expect(await fetchProjects()).toBeNull();
  });
});
