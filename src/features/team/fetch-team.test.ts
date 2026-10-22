import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServer: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));

import { fetchOpsTeam } from "@/features/team/fetch-team";

describe("fetchOpsTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServer.mockResolvedValue({ functions: { invoke: mocks.invoke } });
  });

  it("maps the existing team service response", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        users: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            email: "neo@example.com",
            is_you: true,
          },
        ],
      },
      error: null,
    });
    await expect(fetchOpsTeam()).resolves.toEqual({
      status: "ok",
      members: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          email: "neo@example.com",
          isYou: true,
        },
      ],
    });
    expect(mocks.invoke).toHaveBeenCalledWith("manage-team", { body: { action: "list" } });
  });

  it("returns an error state for a malformed response", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.invoke.mockResolvedValue({ data: {}, error: null });
    await expect(fetchOpsTeam()).resolves.toEqual({ status: "error" });
    spy.mockRestore();
  });
});
