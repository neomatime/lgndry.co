import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };

const enquiryResult: Result = { data: null, error: null };
const projectResult: Result = { data: null, error: null };
const clientResult: Result = { data: null, error: null };
const contactsResult: Result = { data: [], error: null };
const fromMock = vi.fn();

function maybeSingleResult(result: Result) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(result)) })),
    })),
  };
}

fromMock.mockImplementation((table: string) => {
  if (table === "enquiries") return maybeSingleResult(enquiryResult);
  if (table === "projects") return maybeSingleResult(projectResult);
  if (table === "clients") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(clientResult)) })),
        })),
      })),
    };
  }
  if (table === "client_contacts") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve(contactsResult)),
            })),
          })),
        })),
      })),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

const ENQUIRY_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const baseEnquiry = {
  id: ENQUIRY_ID,
  client_id: CLIENT_ID,
  full_name: "Thandi Mokoena",
  project_type: "Film",
  location: "Limpopo",
  timeline: "Spring, once the rains arrive",
  description: "A short place-led film.",
  budget: "R20k-R30k",
  status: "Quoted",
  archived: false,
};

beforeEach(() => {
  enquiryResult.data = baseEnquiry;
  enquiryResult.error = null;
  projectResult.data = null;
  projectResult.error = null;
  clientResult.data = { id: CLIENT_ID, name: "Blackridge" };
  clientResult.error = null;
  contactsResult.data = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      full_name: "Thandi Mokoena",
      email: "thandi@example.com",
      phone: null,
      is_primary: true,
    },
  ];
  contactsResult.error = null;
  vi.clearAllMocks();
});

describe("fetchProjectConversion", () => {
  it("builds editable defaults and preserves ambiguous source references", async () => {
    const { fetchProjectConversion } = await import("@/features/projects/fetch-project-conversion");
    const result = await fetchProjectConversion(ENQUIRY_ID);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.client.name).toBe("Blackridge");
      expect(result.values).toMatchObject({
        name: "Film - Blackridge",
        clientId: CLIENT_ID,
        clientContactId: "33333333-3333-4333-8333-333333333333",
        overview: "A short place-led film.",
        startDate: "",
        scheduleNotes: "Spring, once the rains arrive",
      });
      expect(result.sourceTimeline).toBe("Spring, once the rains arrive");
      expect(result.sourceBudget).toBe("R20k-R30k");
    }
  });

  it("returns not-found for malformed, missing, and archived enquiries", async () => {
    const { fetchProjectConversion } = await import("@/features/projects/fetch-project-conversion");
    expect(await fetchProjectConversion("not-a-real-id")).toEqual({ status: "not-found" });
    expect(fromMock).not.toHaveBeenCalled();

    enquiryResult.data = null;
    expect(await fetchProjectConversion("40000000-0000-4000-8000-000000000001")).toEqual({
      status: "not-found",
    });
    enquiryResult.data = { ...baseEnquiry, archived: true };
    expect(await fetchProjectConversion("40000000-0000-4000-8000-000000000002")).toEqual({
      status: "not-found",
    });
  });

  it("links to the existing project when the enquiry was already converted", async () => {
    projectResult.data = { id: "99999999-9999-4999-8999-999999999999" };
    const { fetchProjectConversion } = await import("@/features/projects/fetch-project-conversion");
    expect(await fetchProjectConversion("40000000-0000-4000-8000-000000000003")).toEqual({
      status: "conflict",
      projectId: "99999999-9999-4999-8999-999999999999",
    });
  });

  it.each(["Completed", "Closed"])("rejects a %s enquiry", async (status) => {
    enquiryResult.data = { ...baseEnquiry, status };
    const { fetchProjectConversion } = await import("@/features/projects/fetch-project-conversion");
    const id =
      status === "Completed"
        ? "40000000-0000-4000-8000-000000000004"
        : "40000000-0000-4000-8000-000000000005";
    expect(await fetchProjectConversion(id)).toMatchObject({ status: "invalid" });
  });

  it("rejects an enquiry without an available client", async () => {
    enquiryResult.data = { ...baseEnquiry, client_id: null };
    const { fetchProjectConversion } = await import("@/features/projects/fetch-project-conversion");
    expect(await fetchProjectConversion("40000000-0000-4000-8000-000000000006")).toMatchObject({
      status: "invalid",
    });
  });

  it.each([
    ["enquiry", enquiryResult],
    ["project", projectResult],
    ["client", clientResult],
    ["contacts", contactsResult],
  ])("returns error when the %s query fails", async (_label, failedResult) => {
    failedResult.error = { message: "connection refused" };
    const ids: Record<string, string> = {
      enquiry: "50000000-0000-4000-8000-000000000001",
      project: "50000000-0000-4000-8000-000000000002",
      client: "50000000-0000-4000-8000-000000000003",
      contacts: "50000000-0000-4000-8000-000000000004",
    };
    const { fetchProjectConversion } = await import("@/features/projects/fetch-project-conversion");
    expect(await fetchProjectConversion(ids[_label]!)).toEqual({ status: "error" });
  });
});
