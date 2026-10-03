import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };

const clientResult: Result = { data: null, error: null };
const contactsResult: Result = { data: [], error: null };
const enquiriesResult: Result = { data: [], error: null };
const projectsResult: Result = { data: [], error: null };
const activityResult: Result = { data: [], error: null };
const fromMock = vi.fn();

function orderedResult(result: Result) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(result)) })),
    })),
  };
}

fromMock.mockImplementation((table: string) => {
  if (table === "clients") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(clientResult)) })),
      })),
    };
  }
  if (table === "client_contacts") return orderedResult(contactsResult);
  if (table === "enquiries") return orderedResult(enquiriesResult);
  if (table === "projects") return orderedResult(projectsResult);
  if (table === "ops_activity_log") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(activityResult)) })),
        })),
      })),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  clientResult.data = null;
  clientResult.error = null;
  contactsResult.data = [];
  contactsResult.error = null;
  enquiriesResult.data = [];
  enquiriesResult.error = null;
  projectsResult.data = [];
  projectsResult.error = null;
  activityResult.data = [];
  activityResult.error = null;
  fromMock.mockClear();
});

const VALID_ID = "11111111-1111-1111-1111-111111111111";
const baseClient = {
  id: VALID_ID,
  name: "Blackridge Hotels",
  type: "Company",
  status: "Active",
  account_tier: "Key Account",
  industry: "Hospitality",
  region: "Limpopo",
  client_since: "2025-03-01",
  account_overview: "A long-term hospitality partner.",
  preferred_services: ["Photography"],
  relationship_notes: "Prefers morning calls.",
  archived: false,
};

describe("fetchClientDetail", () => {
  it("loads and shapes the client, contacts, enquiries, and activity", async () => {
    clientResult.data = baseClient;
    contactsResult.data = [
      {
        id: "contact-1",
        full_name: "Thandi Mokoena",
        role_title: "Marketing Director",
        email: "thandi@example.com",
        phone: "0761234567",
        is_primary: true,
      },
    ];
    enquiriesResult.data = [
      {
        id: "enquiry-1",
        project_type: "Documentary",
        status: "New",
        created_at: "2026-09-20T08:00:00Z",
      },
    ];
    projectsResult.data = [
      {
        id: "project-1",
        name: "Autumn Campaign",
        status: "Production",
        start_date: "2026-10-01",
        end_date: "2026-10-10",
        delivery_status: "In progress",
        archived: false,
      },
    ];
    activityResult.data = [
      {
        id: "activity-1",
        message: "Client created",
        created_at: "2026-09-20T08:00:00Z",
      },
    ];

    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    const result = await fetchClientDetail(VALID_ID);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.client.contacts[0]!.email).toBe("thandi@example.com");
      expect(result.client.enquiries[0]!.projectType).toBe("Documentary");
      expect(result.client.projects[0]!.name).toBe("Autumn Campaign");
      expect(result.client.openEnquiryCount).toBe(1);
      expect(result.client.activity[0]!.message).toBe("Client created");
    }
    expect(fromMock).toHaveBeenCalledTimes(5);
  });

  it("returns an archived client with its contacts and no enquiries", async () => {
    clientResult.data = { ...baseClient, archived: true };
    contactsResult.data = [
      {
        id: "contact-1",
        full_name: "Thandi Mokoena",
        role_title: null,
        email: "thandi@example.com",
        phone: null,
        is_primary: true,
      },
    ];

    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    const result = await fetchClientDetail("22222222-2222-2222-2222-222222222222");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.client.archived).toBe(true);
      expect(result.client.contacts).toHaveLength(1);
      expect(result.client.enquiries).toEqual([]);
    }
  });

  it("returns not-found for a malformed id without querying the database", async () => {
    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    expect(await fetchClientDetail("not-a-real-id")).toEqual({ status: "not-found" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the client does not exist", async () => {
    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    expect(await fetchClientDetail("33333333-3333-3333-3333-333333333333")).toEqual({
      status: "not-found",
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["client", clientResult],
    ["contacts", contactsResult],
    ["enquiries", enquiriesResult],
    ["projects", projectsResult],
    ["activity", activityResult],
  ])("returns error when the %s query fails", async (_label, failedResult) => {
    clientResult.data = baseClient;
    failedResult.error = { message: "connection refused" };

    const { fetchClientDetail } = await import("@/features/clients/fetch-client-detail");
    const ids: Record<string, string> = {
      client: "44444444-4444-4444-4444-444444444444",
      contacts: "55555555-5555-5555-5555-555555555555",
      enquiries: "66666666-6666-6666-6666-666666666666",
      projects: "77777777-7777-7777-7777-777777777777",
      activity: "88888888-8888-8888-8888-888888888888",
    };
    expect(await fetchClientDetail(ids[_label]!)).toEqual({ status: "error" });
  });
});
