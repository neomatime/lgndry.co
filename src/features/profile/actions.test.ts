import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  createServer: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.authGuard }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateOpsPassword, updateOpsProfile } from "@/features/profile/actions";

describe("profile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGuard.mockResolvedValue({ id: "user-1" });
    mocks.createServer.mockResolvedValue({ auth: { updateUser: mocks.updateUser } });
    mocks.updateUser.mockResolvedValue({ error: null });
  });

  it("updates the authenticated user's display name", async () => {
    await expect(updateOpsProfile({ fullName: "Neo Matime" })).resolves.toMatchObject({
      status: "success",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { full_name: "Neo Matime" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ops", "layout");
  });

  it("rejects mismatched passwords before database access", async () => {
    await expect(
      updateOpsPassword({ password: "new-password", confirmPassword: "different" }),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("updates a valid password", async () => {
    await expect(
      updateOpsPassword({ password: "new-password", confirmPassword: "new-password" }),
    ).resolves.toMatchObject({ status: "success" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });
});
