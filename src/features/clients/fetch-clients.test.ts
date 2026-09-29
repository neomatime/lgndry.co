import { beforeEach, describe, expect, it, vi } from "vitest";

const clientsResult = { data: [] as unknown[], error: null as { message: string } | null };
const activityResult = { data: [] as unknown[], error: null as { message: string } | null };
const clientsSelect = vi.fn();
const clientsOrder = vi.fn(() => Promise.resolve(clientsResult));
const activitySelect = vi.fn();
const activityCollectionEq = vi.fn();
const activityOrder = vi.fn(() => Promise.resolve(activityResult));

const fromMock = vi.fn((table: string) => {
  if (table === "clients") {
    return {
      select: clientsSelect.mockImplementation(() => ({ order: clientsOrder })),
    };
  }
  if (table === "ops_activity_log") {
    return {
      select: activitySelect.mockImplementation(() => ({
        eq: activityCollectionEq.mockImplementation(() => ({ order: activityOrder })),
      })),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  clientsResult.data = [];
  clientsResult.error = null;
  activityResult.data = [];
  activityResult.error = null;
  vi.clearAllMocks();
});

const baseClient = {
  id: "11111111-1111-1111-1111-111111111111",
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
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-10T08:00:00Z",
  client_contacts: [
    {
      id: "contact-1",
      full_name: "Thandi Mokoena",
      role_title: "Marketing Director",
      email: "thandi@example.com",
      phone: "0761234567",
      is_primary: true,
    },
  ],
  enquiries: [
    {
      id: "enquiry-1",
      project_type: "Documentary",
      status: "New",
      created_at: "2026-09-12T08:00:00Z",
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Autumn Campaign",
      status: "Production",
      start_date: "2026-10-01",
      end_date: "2026-10-10",
      delivery_status: "In progress",
      archived: false,
    },
  ],
};

describe("fetchClients", () => {
  it("loads, orders, and shapes clients with their latest activity", async () => {
    clientsResult.data = [baseClient];
    activityResult.data = [
      {
        id: "activity-1",
        record_id: baseClient.id,
        message: "Client updated",
        created_at: "2026-09-20T08:00:00Z",
      },
      {
        id: "activity-2",
        record_id: baseClient.id,
        message: "Client created",
        created_at: "2026-09-15T08:00:00Z",
      },
    ];

    const { fetchClients } = await import("@/features/clients/fetch-clients");
    const result = await fetchClients();

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: "Blackridge Hotels",
      openEnquiryCount: 1,
      lastActivityAt: "2026-09-20T08:00:00Z",
    });
    expect(result![0]!.enquiries[0]).toMatchObject({ projectType: "Documentary" });
    expect(result![0]!.projects[0]).toMatchObject({ name: "Autumn Campaign" });
    expect(result![0]!.activity[0]).toMatchObject({ message: "Client updated" });
    expect(clientsSelect).toHaveBeenCalledWith(expect.stringContaining("client_contacts"));
    expect(clientsSelect).toHaveBeenCalledWith(expect.stringContaining("enquiries"));
    expect(clientsSelect).toHaveBeenCalledWith(expect.stringContaining("projects"));
    expect(clientsOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(activityCollectionEq).toHaveBeenCalledWith("collection", "clients");
    expect(activityOrder).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("supports clients with no linked enquiries", async () => {
    clientsResult.data = [{ ...baseClient, enquiries: [] }];

    const { fetchClients } = await import("@/features/clients/fetch-clients");
    const result = await fetchClients();

    expect(result![0]!.openEnquiryCount).toBe(0);
    expect(result![0]!.lastActivityAt).toBe(baseClient.updated_at);
  });

  it("keeps archived client contacts available for previews", async () => {
    clientsResult.data = [{ ...baseClient, archived: true }];

    const { fetchClients } = await import("@/features/clients/fetch-clients");
    const result = await fetchClients();

    expect(result![0]!.archived).toBe(true);
    expect(result![0]!.primaryContact?.email).toBe("thandi@example.com");
  });

  it.each([
    ["clients", clientsResult],
    ["activity", activityResult],
  ])("returns null when the %s query fails", async (_label, failedResult) => {
    failedResult.error = { message: "connection refused" };

    const { fetchClients } = await import("@/features/clients/fetch-clients");
    expect(await fetchClients()).toBeNull();
  });
});
