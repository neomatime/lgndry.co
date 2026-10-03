import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The enquiry EDIT page shares `fetchEnquiryDetail`, so that fetch must stay independent of
 * follow-ups: it neither queries them (nor looks up the client) and doesn't fail when they are
 * unavailable. Only the detail page's own loader (`fetchEnquiryDetailPage`) composes them in.
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

const ENQUIRY = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Thandi Mokoena",
  company: null,
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary",
  location: "Polokwane",
  timeline: "Flexible",
  description: "A short documentary series.",
  budget: null,
  status: "New",
  source: "Website",
  created_at: "2026-09-27T10:00:00Z",
};

const tables: string[] = [];
const fromMock = vi.fn((table: string) => {
  tables.push(table);
  if (table === "follow_ups") throw new Error("the enquiry edit path must not query follow_ups");
  if (table === "clients") throw new Error("the enquiry edit path must not look up the client");
  return chain({
    data: table === "enquiries" ? ENQUIRY : table === "projects" ? null : [],
    error: null,
  });
});
vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock, storage: { from: vi.fn() } }),
}));

beforeEach(() => {
  tables.length = 0;
  fromMock.mockClear();
  relatedMock.mockReset();
});

describe("fetchEnquiryDetail (edit-page path)", () => {
  it("makes exactly its original queries and never asks for follow-ups or the client", async () => {
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    const result = await fetchEnquiryDetail("11111111-1111-4111-8111-111111111111");
    expect(result.status).toBe("ok");
    expect(relatedMock).not.toHaveBeenCalled();
    expect(tables.sort()).toEqual([
      "enquiries",
      "enquiry_attachments",
      "ops_activity_log",
      "projects",
    ]);
  });

  it("is unaffected by an unavailable follow-ups query", async () => {
    relatedMock.mockResolvedValue(null);
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    const result = await fetchEnquiryDetail("11111111-1111-4111-8111-111111111112");
    expect(result.status).toBe("ok");
    expect(relatedMock).not.toHaveBeenCalled();
  });
});
