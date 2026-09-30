import { beforeEach, describe, expect, it, vi } from "vitest";

const followUpsResult = { data: [] as unknown[], error: null as { message: string } | null };

const eqMock = vi.fn(() => ({ order: () => Promise.resolve(followUpsResult) }));
const fromMock = vi.fn((table: string) => {
  if (table === "follow_ups") return { select: () => ({ eq: eqMock }) };
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  followUpsResult.data = [];
  followUpsResult.error = null;
  fromMock.mockClear();
  eqMock.mockClear();
});

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "f1",
    reference_number: 1,
    client_id: "client-1",
    contact_id: null,
    enquiry_id: null,
    project_id: null,
    follow_up_type: "Client Check-in",
    custom_type: null,
    title: "Call client",
    overview: "",
    notes: "",
    due_date: "2026-10-05",
    due_time: null,
    priority: "Medium",
    contact_methods: ["Phone"],
    status: "Open",
    outcome: null,
    cancellation_reason: null,
    completed_at: null,
    cancelled_at: null,
    owner_user_id: "user-1",
    owner_name: "Neo",
    owner_email: "neo@example.com",
    series_id: null,
    occurrence_number: 1,
    successor_id: null,
    version: 1,
    created_at: "2026-09-29T08:00:00Z",
    updated_at: "2026-09-29T08:00:00Z",
    client_record: { id: "client-1", name: "Blackridge Hotels" },
    contact_record: null,
    enquiry_record: null,
    project_record: null,
    follow_up_checklist_items: [],
    ...overrides,
  };
}

describe("fetchRelatedFollowUps", () => {
  it.each([
    ["client_id", "client-1"] as const,
    ["enquiry_id", "enquiry-1"] as const,
    ["project_id", "project-1"] as const,
  ])("filters by %s when given %s", async (relation, id) => {
    followUpsResult.data = [buildRow()];

    const { fetchRelatedFollowUps } =
      await import("@/features/follow-ups/fetch-related-follow-ups");
    const result = await fetchRelatedFollowUps(relation, id);

    expect(eqMock).toHaveBeenCalledWith(relation, id);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when there are no related follow-ups", async () => {
    followUpsResult.data = [];

    const { fetchRelatedFollowUps } =
      await import("@/features/follow-ups/fetch-related-follow-ups");
    expect(await fetchRelatedFollowUps("client_id", "client-1")).toEqual([]);
  });

  it("returns null and logs when the query fails", async () => {
    followUpsResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchRelatedFollowUps } =
      await import("@/features/follow-ups/fetch-related-follow-ups");
    expect(await fetchRelatedFollowUps("project_id", "project-1")).toBeNull();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
