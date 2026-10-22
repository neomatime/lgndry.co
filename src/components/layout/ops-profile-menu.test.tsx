import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsProfileMenu } from "@/components/layout/ops-profile-menu";

describe("OpsProfileMenu", () => {
  it("keeps profile, settings and sign out together in the account menu", () => {
    render(
      <OpsProfileMenu user={{ id: "user-1", name: "Neo Matime", email: "neo@example.com" }} />,
    );
    const trigger = screen.getByRole("button", { name: /Neo Matime/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/ops/profile",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/ops/settings",
    );
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("menu")).toHaveAttribute("aria-label", "Account menu");
  });
});
