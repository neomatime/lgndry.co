import { beforeEach, describe, expect, it, vi } from "vitest";

const enquiryResult = { data: null as unknown, error: null as { message: string } | null };
const attachmentsResult = { data: [] as unknown[], error: null as { message: string } | null };
const activityResult = { data: [] as unknown[], error: null as { message: string } | null };
const projectResult = { data: null as unknown, error: null as { message: string } | null };
const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/x" } }));

const fromMock = vi.fn((table: string) => {
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
  if (table === "projects") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(projectResult) }) }),
    };
  }
  return {
    select: () => ({
      eq: () => ({ eq: () => ({ order: () => Promise.resolve(activityResult) }) }),
    }),
  };
});

const fakeClient = {
  from: fromMock,
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
  projectResult.data = null;
  projectResult.error = null;
  createSignedUrl.mockClear();
  fromMock.mockClear();
});

const VALID_ID = "11111111-1111-1111-1111-111111111111";

describe("fetchEnquiryDetail", () => {
  it("returns ok with the shaped enquiry on success", async () => {
    enquiryResult.data = {
      id: VALID_ID,
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
    const result = await fetchEnquiryDetail(VALID_ID);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.enquiry.id).toBe(VALID_ID);
      expect(result.enquiry.project).toBeNull();
    }
  });

  it("includes the linked project when the enquiry has been converted", async () => {
    enquiryResult.data = {
      id: VALID_ID,
      full_name: "Thandi Mokoena",
      company: "Blackridge Hotels",
      email: "thandi@example.com",
      phone: "0761234567",
      project_type: "Documentary",
      location: "Polokwane",
      timeline: "Next 1-3 months",
      description: "A short documentary series.",
      budget: null,
      status: "Reviewing",
      source: "Website",
      created_at: "2026-09-27T10:00:00Z",
    };
    projectResult.data = { id: "project-1", name: "Autumn Campaign", status: "Production" };

    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    const result = await fetchEnquiryDetail(VALID_ID);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.enquiry.project).toEqual(projectResult.data);
    }
  });

  it("returns not-found when no matching row exists", async () => {
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail("00000000-0000-0000-0000-000000000000")).toEqual({
      status: "not-found",
    });
  });

  it("returns not-found for a malformed id without querying the database", async () => {
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail("not-a-real-id")).toEqual({ status: "not-found" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns error when the enquiry query fails", async () => {
    enquiryResult.error = { message: "connection refused" };
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail(VALID_ID)).toEqual({ status: "error" });
  });

  it("returns error when the linked-project query fails", async () => {
    enquiryResult.data = {
      id: VALID_ID,
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
    projectResult.error = { message: "connection refused" };

    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail(VALID_ID)).toEqual({ status: "error" });
  });
});
