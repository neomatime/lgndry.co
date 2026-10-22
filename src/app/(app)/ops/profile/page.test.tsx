import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: auth }));
vi.mock("@/features/profile/components/profile-form", () => ({
  ProfileForm: ({ user }: { user: { email: string } }) => <output>{user.email}</output>,
}));

import ProfilePage, { metadata } from "@/app/(app)/ops/profile/page";

describe("ProfilePage", () => {
  it("authenticates and renders the current account", async () => {
    auth.mockResolvedValue({ id: "user-1", name: "Neo Matime", email: "neo@example.com" });
    render(await ProfilePage());
    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("neo@example.com")).toBeInTheDocument();
  });

  it("sets metadata", () => {
    expect(metadata).toEqual({ title: "Profile" });
  });
});
