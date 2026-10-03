import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The client EDIT page shares `fetchClientDetail`, so that fetch must stay independent of
 * follow-ups: it neither queries them nor fails when they are unavailable. Only the detail
 * page's own loader (`fetchClientDetailPage`) composes follow-ups in.
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

const tables: string[] = [];
const fromMock = vi.fn((table: string) => {
  tables.push(table);
  if (table === "follow_ups") throw new Error("the client edit path must not query follow_ups");
  return chain({
    data:
      table === "clients"
        ? {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Blackridge Hotels",
            type: "Company",
            status: "Active",
            account_tier: "Standard",
            industry: null,
            region: null,
            client_since: "2026-01-01",
            account_overview: null,
            preferred_services: [],
            relationship_notes: null,
            archived: false,
          }
        : [],
    error: null,
  });
});
vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  tables.length = 0;
  fromMock.mockClear();
  relatedMock.mockReset();
});

describe("fetchClientDetail (edit-page path)", () => {
  it("makes exactly its original five queries and never asks for follow-ups", async () => {
    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    const result = await fetchClientDetail("11111111-1111-1111-1111-111111111111");
    expect(result.status).toBe("ok");
    expect(relatedMock).not.toHaveBeenCalled();
    expect(tables.sort()).toEqual([
      "client_contacts",
      "clients",
      "enquiries",
      "ops_activity_log",
      "projects",
    ]);
  });

  it("is unaffected by an unavailable follow-ups query", async () => {
    relatedMock.mockResolvedValue(null);
    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    const result = await fetchClientDetail("11111111-1111-1111-1111-111111111112");
    expect(result.status).toBe("ok");
    expect(relatedMock).not.toHaveBeenCalled();
  });
});
