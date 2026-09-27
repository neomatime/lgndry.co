import { beforeEach, describe, expect, it, vi } from "vitest";

const enquiryResult = { data: null as unknown, error: null as { message: string } | null };
const attachmentsResult = { data: [] as unknown[], error: null as { message: string } | null };
const activityResult = { data: [] as unknown[], error: null as { message: string } | null };
const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/x" } }));

const fakeClient = {
  from: (table: string) => {
    if (table === "enquiries") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(enquiryResult),
          }),
        }),
      };
    }
    if (table === "enquiry_attachments") {
      return { select: () => ({ eq: () => Promise.resolve(attachmentsResult) }) };
    }
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ order: () => Promise.resolve(activityResult) }) }),
      }),
    };
  },
  storage: { from: () => ({ createSignedUrl }) },
};

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => fakeClient,
}));

beforeEach(() => {
  enquiryResult.data = null;
  enquiryResult.error = null;
  attachmentsResult.data = [];
  attachmentsResult.error = null;
  activityResult.data = [];
  activityResult.error = null;
  createSignedUrl.mockClear();
});

describe("fetchEnquiryDetail", () => {
  it("returns ok with the shaped enquiry on success", async () => {
    enquiryResult.data = {
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
      source: "Website",
      created_at: "2026-09-27T10:00:00Z",
    };

    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    const result = await fetchEnquiryDetail("e1");

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.enquiry.id).toBe("e1");
  });

  it("returns not-found when no matching row exists", async () => {
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail("missing")).toEqual({ status: "not-found" });
  });

  it("returns error when the enquiry query fails", async () => {
    enquiryResult.error = { message: "connection refused" };
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail("e1")).toEqual({ status: "error" });
  });
});
