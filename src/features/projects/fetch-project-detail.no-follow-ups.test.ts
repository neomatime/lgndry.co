import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The project EDIT page reaches `fetchProjectDetail` through `fetchProjectFormData`, so that
 * fetch must stay independent of follow-ups: it neither queries them nor fails when they are
 * unavailable. Only the detail page's own loader (`fetchProjectDetailPage`) composes them in.
 */
const { relatedMock } = vi.hoisted(() => ({ relatedMock: vi.fn() }));
vi.mock("@/features/follow-ups/fetch-related-follow-ups", () => ({
  fetchRelatedFollowUps: relatedMock,
}));

type Result = { data: unknown; error: null };
function chain(result: Result) {
  const c = {
    select: () => c,
    eq: () => c,
    order: () => c,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return c;
}

const PROJECT = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Autumn Campaign",
  client: "22222222-2222-4222-8222-222222222222",
  client_contact_id: null,
  project_type: "Film",
  services: [],
  brief: null,
  location: null,
  start_date: null,
  end_date: null,
  timeline: null,
  people_resources: null,
  budget_min: null,
  budget_max: null,
  currency: "ZAR",
  status: "Planning",
  stage_position: 0,
  payment_status: "Not Invoiced",
  delivery_status: "Not Ready",
  archived: false,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-01T08:00:00Z",
  enquiry_id: null,
  booking: null,
  client_record: { id: "22222222-2222-4222-8222-222222222222", name: "Blackridge" },
  contact_record: null,
  project_tasks: null,
  project_deliverables: null,
};

const tables: string[] = [];
const fromMock = vi.fn((table: string) => {
  tables.push(table);
  if (table === "follow_ups") throw new Error("the project edit path must not query follow_ups");
  return chain({ data: table === "projects" ? PROJECT : [], error: null });
});
vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  tables.length = 0;
  fromMock.mockClear();
  relatedMock.mockReset();
});

describe("fetchProjectDetail (edit-page path)", () => {
  it("makes exactly its original queries and never asks for follow-ups or the client", async () => {
    const { fetchProjectDetail } = await import("@/features/projects/fetch-project-detail");
    const result = await fetchProjectDetail("11111111-1111-4111-8111-111111111111");
    expect(result.status).toBe("ok");
    expect(relatedMock).not.toHaveBeenCalled();
    expect(tables.sort()).toEqual([
      "ops_activity_log",
      "project_deliverables",
      "project_milestones",
      "project_tasks",
      "projects",
    ]);
  });

  it("is unaffected by an unavailable follow-ups query", async () => {
    relatedMock.mockResolvedValue(null);
    const { fetchProjectDetail } = await import("@/features/projects/fetch-project-detail");
    const result = await fetchProjectDetail("11111111-1111-4111-8111-111111111112");
    expect(result.status).toBe("ok");
    expect(relatedMock).not.toHaveBeenCalled();
  });
});
