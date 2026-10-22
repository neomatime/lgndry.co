import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/team/fetch-team", () => ({ fetchOpsTeam: mocks.fetch }));
vi.mock("@/features/team/components/team-manager", () => ({
  TeamManager: ({ members }: { members: unknown[] }) => <output>{members.length} members</output>,
}));

import TeamPage, { metadata } from "@/app/(app)/ops/settings/team/page";

describe("TeamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ id: "admin" });
    mocks.fetch.mockResolvedValue({
      status: "ok",
      members: [{ id: "user-1", email: "neo@example.com", isYou: true }],
    });
  });

  it("authenticates before loading the team", async () => {
    const order: string[] = [];
    mocks.auth.mockImplementation(async () => {
      order.push("auth");
    });
    mocks.fetch.mockImplementation(async () => {
      order.push("fetch");
      return { status: "ok", members: [] };
    });
    render(await TeamPage());
    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByRole("heading", { level: 1, name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Settings" })).toHaveAttribute(
      "href",
      "/ops/settings",
    );
  });

  it("renders a distinct unavailable state", async () => {
    mocks.fetch.mockResolvedValue({ status: "error" });
    render(await TeamPage());
    expect(screen.getByText("Team members are temporarily unavailable")).toBeInTheDocument();
  });

  it("sets metadata", () => {
    expect(metadata).toEqual({ title: "Team" });
  });
});
