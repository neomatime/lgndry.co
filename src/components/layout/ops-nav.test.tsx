import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsNav } from "@/components/layout/ops-nav";

const navigation = vi.hoisted(() => ({ pathname: "/ops" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = "/ops";
});

describe("OpsNav", () => {
  it("renders Projects and Clients as available links in the mandated order", () => {
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
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/ops/projects");
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute("href", "/ops/clients");
  });

  it("renders Follow-ups as an available link in its approved position", () => {
    render(<OpsNav />);
    const items = Array.from(
      screen
        .getByRole("navigation", { name: "Command Center" })
        .querySelectorAll("a, [aria-disabled='true']"),
    );
    const link = screen.getByRole("link", { name: "Follow-ups" });
    expect(link).toHaveAttribute("href", "/ops/follow-ups");
    expect(items.indexOf(link)).toBe(5);
    expect(items[4]?.textContent).toContain("Inbox");
    expect(items[6]?.textContent).toContain("Invoices");
    expect(screen.queryByText("Follow-ups")?.closest("span[aria-disabled='true']")).toBeNull();
  });

  it.each(["/ops/follow-ups", "/ops/follow-ups/new", "/ops/follow-ups/follow-up-id"])(
    "marks Follow-ups current on %s",
    (pathname) => {
      navigation.pathname = pathname;
      render(<OpsNav />);
      expect(screen.getByRole("link", { name: "Follow-ups" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      for (const other of ["Command Center", "Enquiries", "Projects", "Clients"]) {
        expect(screen.getByRole("link", { name: other })).not.toHaveAttribute("aria-current");
      }
    },
  );

  it("does not mark Follow-ups current elsewhere", () => {
    navigation.pathname = "/ops/clients/client-id";
    render(<OpsNav />);
    expect(screen.getByRole("link", { name: "Follow-ups" })).not.toHaveAttribute("aria-current");
  });

  it.each(["/ops/projects", "/ops/projects/new", "/ops/projects/project-id/edit"])(
    "marks Projects current on %s",
    (pathname) => {
      navigation.pathname = pathname;
      render(<OpsNav />);
      expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    },
  );

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
    for (const label of ["Inbox", "Invoices", "Settings"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
      expect(screen.getByText(label).closest("span[aria-disabled='true']")).toBeInTheDocument();
    }
  });
});
