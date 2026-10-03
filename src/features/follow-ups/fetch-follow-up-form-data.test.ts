import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FollowUpDetail } from "@/features/follow-ups/types";

type Result = { data: unknown[]; error: { message: string } | null };

const clientsResult: Result = { data: [], error: null };
const contactsResult: Result = { data: [], error: null };
const enquiriesResult: Result = { data: [], error: null };
const projectsResult: Result = { data: [], error: null };

const fetchFollowUpDetailMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "clients") {
    return { select: () => ({ eq: () => ({ order: () => Promise.resolve(clientsResult) }) }) };
  }
  if (table === "client_contacts") {
    return { select: () => ({ eq: () => ({ order: () => Promise.resolve(contactsResult) }) }) };
  }
  if (table === "enquiries") {
    return { select: () => ({ eq: () => ({ order: () => Promise.resolve(enquiriesResult) }) }) };
  }
  if (table === "projects") {
    return { select: () => ({ eq: () => ({ order: () => Promise.resolve(projectsResult) }) }) };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

vi.mock("@/features/follow-ups/fetch-follow-up-detail", () => ({
  fetchFollowUpDetail: fetchFollowUpDetailMock,
}));

beforeEach(() => {
  clientsResult.data = [];
  clientsResult.error = null;
  contactsResult.data = [];
  contactsResult.error = null;
  enquiriesResult.data = [];
  enquiriesResult.error = null;
  projectsResult.data = [];
  projectsResult.error = null;
  vi.clearAllMocks();
});

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function buildDetail(overrides: Partial<FollowUpDetail> = {}): FollowUpDetail {
  return {
    id: VALID_ID,
    reference: "FUP-00001",
    clientId: "client-1",
    clientName: "Blackridge Hotels",
    contact: null,
    related: null,
    followUpType: "Client Check-in",
    customType: "",
    displayType: "Client Check-in",
    title: "Call client",
    overview: "",
    notes: "",
    dueDate: "2026-10-05",
    dueTime: "",
    priority: "Medium",
    contactMethods: ["Phone"],
    status: "Open",
    scheduleState: "Upcoming",
    outcome: "",
    cancellationReason: "",
    completedAt: null,
    cancelledAt: null,
    owner: { id: "user-1", name: "Neo", email: "neo@example.com" },
    seriesId: null,
    occurrenceNumber: 1,
    successorId: null,
    version: 1,
    createdAt: "2026-09-29T08:00:00Z",
    updatedAt: "2026-09-29T08:00:00Z",
    checklist: [],
    series: null,
    predecessorId: null,
    activity: [],
    ...overrides,
  };
}

describe("fetchFollowUpFormOptions", () => {
  it("shapes clients with their nested contacts/enquiries/projects filtered by client", async () => {
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
        phone: "0761234567",
        role_title: "Ops Manager",
      },
    ];
    enquiriesResult.data = [
      {
        id: "11111111-2222-3333-4444-555555555555",
        client_id: "client-1",
        project_type: "Documentary",
        created_at: "2026-09-01T00:00:00Z",
      },
    ];
    projectsResult.data = [{ id: "project-1", client: "client-1", name: "Autumn Campaign" }];

    const { fetchFollowUpFormOptions } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    const result = await fetchFollowUpFormOptions();

    expect(result).toEqual([
      {
        id: "client-1",
        name: "Blackridge",
        contacts: [
          {
            id: "contact-1",
            fullName: "Thandi Mokoena",
            email: "thandi@example.com",
            phone: "0761234567",
            role: "Ops Manager",
          },
        ],
        enquiries: [
          { id: "11111111-2222-3333-4444-555555555555", label: "Documentary · 11111111" },
        ],
        projects: [{ id: "project-1", label: "Autumn Campaign" }],
      },
      // A client with no matching contacts, enquiries, or projects still
      // gets empty arrays rather than being dropped.
      { id: "client-2", name: "Unnamed client", contacts: [], enquiries: [], projects: [] },
    ]);
  });

  it("labels a project with a NULL or blank name 'Untitled project', never 'null'", async () => {
    clientsResult.data = [{ id: "client-1", name: "Blackridge" }];
    projectsResult.data = [
      { id: "project-1", client: "client-1", name: null },
      { id: "project-2", client: "client-1", name: "   " },
      { id: "project-3", client: "client-1", name: "Autumn Campaign" },
    ];

    const { fetchFollowUpFormOptions } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    const result = await fetchFollowUpFormOptions();

    expect(result?.[0]?.projects).toEqual([
      { id: "project-1", label: "Untitled project" },
      { id: "project-2", label: "Untitled project" },
      { id: "project-3", label: "Autumn Campaign" },
    ]);
  });

  it.each([
    ["clients", clientsResult],
    ["contacts", contactsResult],
    ["enquiries", enquiriesResult],
    ["projects", projectsResult],
  ])("returns null when the %s query fails", async (_label, failedResult) => {
    failedResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchFollowUpFormOptions } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    expect(await fetchFollowUpFormOptions()).toBeNull();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

describe("fetchFollowUpFormData", () => {
  it("combines form options with the editable follow-up values on success", async () => {
    clientsResult.data = [{ id: "client-1", name: "Blackridge" }];
    const detail = buildDetail();
    fetchFollowUpDetailMock.mockResolvedValue({ status: "ok", followUp: detail });

    const { fetchFollowUpFormData } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    const { followUpDetailToInput } = await import("@/features/follow-ups/detail-view-model");
    const result = await fetchFollowUpFormData(VALID_ID);

    expect(result).toEqual({
      status: "ok",
      clients: [{ id: "client-1", name: "Blackridge", contacts: [], enquiries: [], projects: [] }],
      followUp: {
        id: detail.id,
        version: detail.version,
        values: followUpDetailToInput(detail),
      },
    });
  });

  it("returns not-found for a malformed id without querying anything", async () => {
    const { fetchFollowUpFormData } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    expect(await fetchFollowUpFormData("not-a-real-id")).toEqual({ status: "not-found" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(fetchFollowUpDetailMock).not.toHaveBeenCalled();
  });

  it("returns not-found when the follow-up detail is missing", async () => {
    fetchFollowUpDetailMock.mockResolvedValue({ status: "not-found" });

    const { fetchFollowUpFormData } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    expect(await fetchFollowUpFormData(VALID_ID)).toEqual({ status: "not-found" });
  });

  it("returns error when the follow-up detail fetch fails", async () => {
    fetchFollowUpDetailMock.mockResolvedValue({ status: "error" });

    const { fetchFollowUpFormData } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    expect(await fetchFollowUpFormData(VALID_ID)).toEqual({ status: "error" });
  });

  it("returns error when the form options query fails even if the detail succeeds", async () => {
    clientsResult.error = { message: "connection refused" };
    fetchFollowUpDetailMock.mockResolvedValue({ status: "ok", followUp: buildDetail() });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { fetchFollowUpFormData } =
      await import("@/features/follow-ups/fetch-follow-up-form-data");
    expect(await fetchFollowUpFormData(VALID_ID)).toEqual({ status: "error" });

    spy.mockRestore();
  });
});
