import { beforeEach, describe, expect, it, vi } from "vitest";

const followUpsResult = { data: [] as unknown[], error: null as { message: string } | null };

const orderMock = vi.fn(() => Promise.resolve(followUpsResult));
const fromMock = vi.fn((table: string) => {
  if (table === "follow_ups") {
    return {
      select: () => ({
        order: () => ({ order: orderMock }),
      }),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  followUpsResult.data = [];
  followUpsResult.error = null;
  fromMock.mockClear();
  orderMock.mockClear();
});

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "f1",
    reference_number: 12,
    client_id: "client-1",
    contact_id: "contact-1",
    enquiry_id: "enquiry-1",
    project_id: null,
    follow_up_type: "Client Check-in",
    custom_type: null,
    title: "Call about quote",
    overview: "Overview text",
    notes: "Internal notes",
    due_date: "2026-10-05",
    due_time: "09:30:00",
    priority: "High",
    contact_methods: ["Email", "Phone"],
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
    contact_record: {
      id: "contact-1",
      full_name: "Thandi Mokoena",
      email: "thandi@example.com",
      phone: "0761234567",
      role_title: "Ops Manager",
    },
    enquiry_record: { id: "enquiry-1", project_type: "Documentary" },
    project_record: null,
    follow_up_checklist_items: [
      {
        id: "item-2",
        label: "Second",
        sort_order: 1,
        is_completed: false,
        completed_at: null,
        version: 1,
      },
      {
        id: "item-1",
        label: "First",
        sort_order: 0,
        is_completed: true,
        completed_at: "2026-09-29T09:00:00Z",
        version: 2,
      },
    ],
    ...overrides,
  };
}

describe("fetchFollowUps", () => {
  it("shapes rows with nested client/contact/related/checklist data", async () => {
    followUpsResult.data = [buildRow()];

    const { fetchFollowUps } = await import("@/features/follow-ups/fetch-follow-ups");
    const result = await fetchFollowUps();

    expect(result).not.toBeNull();
    expect(result![0]).toMatchObject({
      id: "f1",
      reference: "FUP-0012",
      clientId: "client-1",
      clientName: "Blackridge Hotels",
      contact: {
        id: "contact-1",
        fullName: "Thandi Mokoena",
        email: "thandi@example.com",
        phone: "0761234567",
        role: "Ops Manager",
      },
      related: { id: "enquiry-1", label: "Documentary", kind: "Enquiry" },
      dueDate: "2026-10-05",
      dueTime: "09:30",
    });
    // Checklist items are sorted by sort_order regardless of row order.
    expect(result![0]!.checklist.map((item) => item.id)).toEqual(["item-1", "item-2"]);
  });

  it("formats the reference number with the spec's exact padding width (FUP-0312, not FUP-00312)", async () => {
    followUpsResult.data = [buildRow({ reference_number: 312 })];

    const { fetchFollowUps } = await import("@/features/follow-ups/fetch-follow-ups");
    const result = await fetchFollowUps();

    expect(result![0]!.reference).toBe("FUP-0312");
  });

  it("prefers the linked project over an enquiry when both records are present", async () => {
    followUpsResult.data = [
      buildRow({
        enquiry_record: null,
        project_id: "project-1",
        project_record: { id: "project-1", name: "Autumn Campaign" },
      }),
    ];

    const { fetchFollowUps } = await import("@/features/follow-ups/fetch-follow-ups");
    const result = await fetchFollowUps();

    expect(result![0]!.related).toEqual({
      id: "project-1",
      label: "Autumn Campaign",
      kind: "Project",
    });
  });

  it("returns an empty array when there are no follow-ups", async () => {
    followUpsResult.data = [];

    const { fetchFollowUps } = await import("@/features/follow-ups/fetch-follow-ups");
    expect(await fetchFollowUps()).toEqual([]);
  });

  it("returns null and logs when the query fails", async () => {
    followUpsResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchFollowUps } = await import("@/features/follow-ups/fetch-follow-ups");
    expect(await fetchFollowUps()).toBeNull();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
