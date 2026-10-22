import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  createServer: vi.fn(),
  invoke: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.authGuard }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { inviteTeamMember, removeTeamMember } from "@/features/team/actions";

describe("team actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockResolvedValue({ id: "admin" });
    mocks.createServer.mockResolvedValue({ functions: { invoke: mocks.invoke } });
    mocks.invoke.mockResolvedValue({ data: {}, error: null });
  });

  it("adds a validated member through the admin-gated team service", async () => {
    await expect(
      inviteTeamMember({ email: "new@example.com", password: "temporary-password" }),
    ).resolves.toMatchObject({ status: "success" });
    expect(mocks.invoke).toHaveBeenCalledWith("manage-team", {
      body: { action: "invite", email: "new@example.com", password: "temporary-password" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ops/settings/team");
  });

  it("rejects an invalid invite before invoking the service", async () => {
    await expect(inviteTeamMember({ email: "nope", password: "short" })).resolves.toMatchObject({
      status: "invalid",
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("removes a validated member through the team service", async () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    await expect(removeTeamMember({ userId })).resolves.toMatchObject({ status: "success" });
    expect(mocks.invoke).toHaveBeenCalledWith("manage-team", {
      body: { action: "remove", userId },
    });
  });
});
