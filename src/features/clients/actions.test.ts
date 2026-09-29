import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOpsUser: vi.fn(),
  createServer: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.requireOpsUser }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createClient, setClientArchived, updateClient } from "@/features/clients/actions";

const id = "123e4567-e89b-42d3-a456-426614174000";
const input = {
  name: "Blackridge Hotels",
  type: "Company",
  status: "Active",
  accountTier: "Key Account",
  industry: "Hospitality",
  region: "Gauteng",
  clientSince: "2026-09-29",
  accountOverview: "Overview",
  preferredServices: ["Photography"],
  relationshipNotes: "Notes",
  contacts: [
    {
      fullName: "James Mitchell",
      roleTitle: "Head of Marketing",
      email: "james@example.com",
      phone: "0123456789",
      isPrimary: true,
    },
  ],
};

describe("client actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOpsUser.mockResolvedValue({ id: "admin" });
    mocks.createServer.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { status: "ok", client_id: id }, error: null });
  });

  it("authenticates before rejecting invalid input", async () => {
    const result = await createClient({});
    expect(mocks.requireOpsUser).toHaveBeenCalledOnce();
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(result.status).toBe("invalid");
  });

  it("creates a normalized client and revalidates", async () => {
    await expect(createClient(input)).resolves.toEqual({ status: "success", clientId: id });
    expect(mocks.rpc).toHaveBeenCalledWith("create_client_with_contacts", {
      p_client: expect.objectContaining({ account_tier: "Key Account" }),
      p_contacts: [expect.objectContaining({ full_name: "James Mitchell", is_primary: true })],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ops/clients");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${id}`);
  });

  it("updates the requested client", async () => {
    await updateClient(id, input);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_client_with_contacts",
      expect.objectContaining({ p_client_id: id }),
    );
  });

  it("returns the conflicting client link target", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "conflict", client_id: id }, error: null });
    await expect(createClient(input)).resolves.toMatchObject({ status: "conflict", clientId: id });
  });

  it("archives through the dedicated RPC", async () => {
    await setClientArchived(id, true);
    expect(mocks.rpc).toHaveBeenCalledWith("set_client_archived", {
      p_client_id: id,
      p_archived: true,
    });
  });

  it("returns a calm error when the database fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(createClient(input)).resolves.toMatchObject({ status: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
