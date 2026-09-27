import { beforeEach, describe, expect, it, vi } from "vitest";

const enquiriesResult = { data: [] as unknown[], error: null as { message: string } | null };

const fakeClient = {
  from: (table: string) => {
    if (table === "enquiries") {
      return {
        select: () => ({
          order: () => Promise.resolve(enquiriesResult),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  },
};

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => fakeClient,
}));

beforeEach(() => {
  enquiriesResult.data = [];
  enquiriesResult.error = null;
});

describe("fetchEnquiries", () => {
  it("shapes rows with their attachment counts on success", async () => {
    // Supabase's JS client returns an embedded `table(count)` select as an
    // array with a single object holding the aggregate, e.g.
    // `enquiry_attachments: [{ count: 2 }]` -- confirmed against PostgREST's
    // documented embedded-resource-aggregate response shape (a `count`
    // embed always resolves to a one-element array, never a bare number).
    enquiriesResult.data = [
      {
        id: "e1",
        full_name: "Thandi Mokoena",
        company: "Blackridge Hotels",
        email: "thandi@example.com",
        phone: "0761234567",
        project_type: "Documentary",
        location: "Polokwane",
        timeline: "Next 1-3 months",
        description: "A short documentary series.",
        budget: "R20,000 - R35,000",
        status: "New",
        created_at: "2026-09-27T10:00:00Z",
        enquiry_attachments: [{ count: 2 }],
      },
    ];

    const { fetchEnquiries } = await import("@/features/enquiries/fetch-enquiries");
    const result = await fetchEnquiries();

    expect(result).not.toBeNull();
    expect(result![0]!.attachmentCount).toBe(2);
  });

  it("returns null when the enquiries query fails", async () => {
    enquiriesResult.error = { message: "connection refused" };

    const { fetchEnquiries } = await import("@/features/enquiries/fetch-enquiries");
    expect(await fetchEnquiries()).toBeNull();
  });
});
