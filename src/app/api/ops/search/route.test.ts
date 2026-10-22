import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/ops/search/route";

const mocks = vi.hoisted(() => ({
  resolveOpsAccess: vi.fn(),
  fetchClients: vi.fn(),
  fetchEnquiries: vi.fn(),
  fetchProjects: vi.fn(),
  fetchInvoices: vi.fn(),
  fetchFollowUps: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ resolveOpsAccess: mocks.resolveOpsAccess }));
vi.mock("@/features/clients/fetch-clients", () => ({ fetchClients: mocks.fetchClients }));
vi.mock("@/features/enquiries/fetch-enquiries", () => ({
  fetchEnquiries: mocks.fetchEnquiries,
}));
vi.mock("@/features/projects/fetch-projects", () => ({ fetchProjects: mocks.fetchProjects }));
vi.mock("@/features/invoices/fetch-invoices", () => ({ fetchInvoices: mocks.fetchInvoices }));
vi.mock("@/features/follow-ups/fetch-follow-ups", () => ({
  fetchFollowUps: mocks.fetchFollowUps,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveOpsAccess.mockResolvedValue({ status: "ok", user: { id: "admin" } });
  mocks.fetchClients.mockResolvedValue([
    {
      id: "client-1",
      name: "Blackridge Hotels",
      status: "Active",
      archived: false,
      primaryContact: null,
    },
  ]);
  mocks.fetchEnquiries.mockResolvedValue([]);
  mocks.fetchProjects.mockResolvedValue([]);
  mocks.fetchInvoices.mockResolvedValue([]);
  mocks.fetchFollowUps.mockResolvedValue([]);
});

describe("GET /api/ops/search", () => {
  it("rejects anonymous requests before loading records", async () => {
    mocks.resolveOpsAccess.mockResolvedValue({ status: "anonymous" });
    const response = await GET(new Request("http://localhost/api/ops/search?q=blackridge"));
    expect(response.status).toBe(401);
    expect(mocks.fetchClients).not.toHaveBeenCalled();
  });

  it("returns real matching records to authenticated OPS users", async () => {
    const response = await GET(new Request("http://localhost/api/ops/search?q=blackridge"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        expect.objectContaining({
          kind: "Client",
          title: "Blackridge Hotels",
          href: "/ops/clients/client-1",
        }),
      ],
    });
  });

  it("returns a service error rather than partial or invented results", async () => {
    mocks.fetchProjects.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/ops/search?q=blackridge"));
    expect(response.status).toBe(503);
  });
});
