import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

let followUpsCalls = 0;
const followUpResult = { data: null as unknown, error: null as { message: string } | null };
const predecessorResult = { data: null as unknown, error: null as { message: string } | null };
const seriesResult = { data: null as unknown, error: null as { message: string } | null };
const activityResult = { data: [] as unknown[], error: null as { message: string } | null };

const fromMock = vi.fn((table: string) => {
  if (table === "follow_ups") {
    followUpsCalls += 1;
    if (followUpsCalls === 1) {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve(followUpResult) }),
        }),
      };
    }
    // Second `follow_ups` query in a call is the predecessor lookup, which
    // chains a second `.eq()` for `occurrence_number`.
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(predecessorResult) }) }),
      }),
    };
  }
  if (table === "follow_up_series") {
    return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(seriesResult) }) }) };
  }
  if (table === "ops_activity_log") {
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ order: () => Promise.resolve(activityResult) }) }),
      }),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  followUpsCalls = 0;
  followUpResult.data = null;
  followUpResult.error = null;
  predecessorResult.data = null;
  predecessorResult.error = null;
  seriesResult.data = null;
  seriesResult.error = null;
  activityResult.data = [];
  activityResult.error = null;
  fromMock.mockClear();
});

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    reference_number: 7,
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

function buildSeriesRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "series-1",
    frequency: "Weekly",
    interval_count: 1,
    weekdays: [1],
    month_anchor: null,
    recurrence_rule: "RRULE:FREQ=WEEKLY",
    ends_on: null,
    max_occurrences: null,
    occurrences_created: 1,
    active: true,
    version: 1,
    ...overrides,
  };
}

describe("fetchFollowUpDetail", () => {
  it("returns not-found for a malformed id without querying the database", async () => {
    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    expect(await fetchFollowUpDetail("not-a-real-id")).toEqual({ status: "not-found" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns not-found when no matching row exists", async () => {
    followUpResult.data = null;
    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    expect(await fetchFollowUpDetail(VALID_ID)).toEqual({ status: "not-found" });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("returns ok with series null and no predecessor query for a non-recurring follow-up", async () => {
    followUpResult.data = buildRow({ series_id: null, occurrence_number: 1 });
    activityResult.data = [
      {
        id: "activity-1",
        message: "Follow-up created: Call client",
        action: "created",
        created_at: "2026-09-29T08:00:00Z",
      },
    ];

    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    const result = await fetchFollowUpDetail(VALID_ID);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.followUp.series).toBeNull();
    expect(result.followUp.predecessorId).toBeNull();
    expect(result.followUp.activity).toHaveLength(1);
    expect(result.followUp.activity[0]!.message).toBe("Follow-up created: Call client");
    // Only the main follow-up query and the activity query should run; no
    // series or predecessor lookups are attempted for a standalone record.
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["follow_ups", "ops_activity_log"]);
  });

  it("returns ok with the series but no predecessor for the first occurrence of a recurring follow-up", async () => {
    followUpResult.data = buildRow({ series_id: "series-1", occurrence_number: 1 });
    seriesResult.data = buildSeriesRow();

    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    const result = await fetchFollowUpDetail(VALID_ID);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.followUp.series).toMatchObject({ id: "series-1", frequency: "Weekly" });
    expect(result.followUp.predecessorId).toBeNull();
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual([
      "follow_ups",
      "follow_up_series",
      "ops_activity_log",
    ]);
  });

  it("returns ok with the predecessor for a later occurrence of a recurring follow-up", async () => {
    followUpResult.data = buildRow({ series_id: "series-1", occurrence_number: 2 });
    seriesResult.data = buildSeriesRow();
    predecessorResult.data = { id: "predecessor-1" };

    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    const result = await fetchFollowUpDetail(VALID_ID);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.followUp.predecessorId).toBe("predecessor-1");
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual([
      "follow_ups",
      "follow_up_series",
      "follow_ups",
      "ops_activity_log",
    ]);
  });

  it("returns error and logs when the series query fails", async () => {
    followUpResult.data = buildRow({ series_id: "series-1", occurrence_number: 1 });
    seriesResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    expect(await fetchFollowUpDetail(VALID_ID)).toEqual({ status: "error" });
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("returns error and logs when the predecessor query fails", async () => {
    followUpResult.data = buildRow({ series_id: "series-1", occurrence_number: 2 });
    seriesResult.data = buildSeriesRow();
    predecessorResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    expect(await fetchFollowUpDetail(VALID_ID)).toEqual({ status: "error" });
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("returns error and logs when the activity query fails", async () => {
    followUpResult.data = buildRow({ series_id: null, occurrence_number: 1 });
    activityResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchFollowUpDetail } = await import("@/features/follow-ups/fetch-follow-up-detail");
    expect(await fetchFollowUpDetail(VALID_ID)).toEqual({ status: "error" });
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
