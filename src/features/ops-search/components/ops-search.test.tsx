import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsSearch } from "@/features/ops-search/components/ops-search";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ops",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("OpsSearch", () => {
  it("opens with the command shortcut and exposes only functional quick actions", () => {
    render(<OpsSearch />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Search Command Center" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New client" })).toHaveAttribute(
      "href",
      "/ops/clients/new",
    );
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "href",
      "/ops/projects/new",
    );
    expect(screen.queryByRole("link", { name: "New enquiry" })).not.toBeInTheDocument();
  });

  it("closes with Escape", () => {
    render(<OpsSearch />);
    fireEvent.click(screen.getByRole("button", { name: "Search Command Center" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
