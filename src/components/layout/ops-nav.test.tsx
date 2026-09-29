import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsNav } from "@/components/layout/ops-nav";

const navigation = vi.hoisted(() => ({ pathname: "/ops" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = "/ops";
});

describe("OpsNav", () => {
  it("renders Clients as an available link in the mandated order", () => {
    render(<OpsNav />);
    const labels = screen
      .getByRole("navigation", { name: "Command Center" })
      .querySelectorAll("a, [aria-disabled='true']");
    expect(Array.from(labels).map((item) => item.textContent?.replace("Soon", "").trim())).toEqual([
      "Command Center",
      "Enquiries",
      "Projects",
      "Clients",
      "Inbox",
      "Follow-ups",
      "Invoices",
      "Settings",
    ]);
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute("href", "/ops/clients");
  });

  it.each(["/ops/clients", "/ops/clients/new", "/ops/clients/client-id/edit"])(
    "marks Clients current on %s",
    (pathname) => {
      navigation.pathname = pathname;
      render(<OpsNav />);
      expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute("aria-current", "page");
    },
  );

  it("keeps unfinished modules disabled", () => {
    render(<OpsNav />);
    for (const label of ["Projects", "Inbox", "Follow-ups", "Invoices", "Settings"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
      expect(screen.getByText(label).closest("span[aria-disabled='true']")).toBeInTheDocument();
    }
  });
});
