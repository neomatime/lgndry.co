import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown[]; error: { message: string } | null };

const clientsResult: Result = { data: [], error: null };
const contactsResult: Result = { data: [], error: null };
const clientArchivedEq = vi.fn();
const clientOrder = vi.fn(() => Promise.resolve(clientsResult));
const contactArchivedEq = vi.fn();
const contactPrimaryOrder = vi.fn();
const contactCreatedOrder = vi.fn(() => Promise.resolve(contactsResult));
const fetchProjectDetailMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "clients") {
    return {
      select: vi.fn(() => ({
        eq: clientArchivedEq.mockImplementation(() => ({ order: clientOrder })),
      })),
    };
  }
  if (table === "client_contacts") {
    return {
      select: vi.fn(() => ({
        eq: contactArchivedEq.mockImplementation(() => ({
          order: contactPrimaryOrder.mockImplementation(() => ({ order: contactCreatedOrder })),
        })),
      })),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

vi.mock("@/features/projects/fetch-project-detail", () => ({
  fetchProjectDetail: fetchProjectDetailMock,
}));

beforeEach(() => {
  clientsResult.data = [];
  clientsResult.error = null;
  contactsResult.data = [];
  contactsResult.error = null;
  vi.clearAllMocks();
});

describe("fetchProjectFormOptions", () => {
  it("returns active clients with active contacts grouped in saved order", async () => {
    clientsResult.data = [
      { id: "client-1", name: "Blackridge" },
      { id: "client-2", name: null },
    ];
    contactsResult.data = [
      {
        id: "contact-1",
        client_id: "client-1",
        full_name: "Thandi Mokoena",
        email: "thandi@example.com",
        phone: null,
        is_primary: true,
      },
    ];

    const { fetchProjectFormOptions } =
      await import("@/features/projects/fetch-project-form-options");
    const result = await fetchProjectFormOptions();

    expect(result).toEqual([
      {
        id: "client-1",
        name: "Blackridge",
        contacts: [
          {
            id: "contact-1",
            fullName: "Thandi Mokoena",
            email: "thandi@example.com",
            phone: "",
            isPrimary: true,
          },
        ],
      },
      { id: "client-2", name: "Unnamed client", contacts: [] },
    ]);
    expect(clientArchivedEq).toHaveBeenCalledWith("archived", false);
    expect(contactArchivedEq).toHaveBeenCalledWith("archived", false);
    expect(contactPrimaryOrder).toHaveBeenCalledWith("is_primary", { ascending: false });
  });

  it.each([
    ["clients", clientsResult],
    ["contacts", contactsResult],
  ])("returns null when the %s query fails", async (_label, failedResult) => {
    failedResult.error = { message: "connection refused" };
    const { fetchProjectFormOptions } =
      await import("@/features/projects/fetch-project-form-options");
    expect(await fetchProjectFormOptions()).toBeNull();
  });

  it("combines options with editable project values", async () => {
    clientsResult.data = [{ id: "client-1", name: "Blackridge" }];
    const project = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Autumn Campaign",
      clientId: "client-1",
      clientName: "Blackridge",
      contact: null,
      projectType: "Film",
      services: ["Film"],
      overview: "A quiet portrait.",
      location: "Limpopo",
      startDate: "",
      endDate: "",
      status: "Planning",
      stagePosition: 0,
      paymentStatus: "Not Invoiced",
      deliveryStatus: "Not Ready",
      archived: false,
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-20T08:00:00Z",
      enquiryId: null,
      bookingId: null,
      tasks: [],
      deliverables: [],
      activity: [],
      scheduleNotes: "",
      peopleResources: "",
      budgetMin: null,
      budgetMax: null,
      currency: "ZAR",
      milestones: [],
      enquiry: null,
      booking: null,
    };
    fetchProjectDetailMock.mockResolvedValue({ status: "ok", project });

    const { fetchProjectFormData } = await import("@/features/projects/fetch-project-form-options");
    const result = await fetchProjectFormData(project.id);

    expect(result).toMatchObject({
      status: "ok",
      clients: [{ id: "client-1", name: "Blackridge" }],
      project: {
        id: project.id,
        archived: false,
        values: { name: "Autumn Campaign", projectType: "Film", budgetMin: "" },
      },
    });
  });

  it("maps malformed, missing, and failed edit fetches", async () => {
    const { fetchProjectFormData } = await import("@/features/projects/fetch-project-form-options");
    expect(await fetchProjectFormData("not-a-real-id")).toEqual({ status: "not-found" });

    fetchProjectDetailMock.mockResolvedValue({ status: "not-found" });
    expect(await fetchProjectFormData("20000000-0000-4000-8000-000000000001")).toEqual({
      status: "not-found",
    });

    fetchProjectDetailMock.mockResolvedValue({ status: "error" });
    expect(await fetchProjectFormData("20000000-0000-4000-8000-000000000002")).toEqual({
      status: "error",
    });
  });
});
