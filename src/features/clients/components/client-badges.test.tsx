import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountTierBadge, ClientStatusBadge } from "@/features/clients/components/client-badges";

describe("client badges", () => {
  it.each(["Lead", "Active", "At Risk", "Inactive"] as const)(
    "renders the %s relationship status",
    (status) => {
      render(<ClientStatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    },
  );

  it("shows Archived without replacing the stored lifecycle status", () => {
    render(<ClientStatusBadge status="Active" archived />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it.each(["Standard", "Key Account"] as const)("renders the %s tier", (tier) => {
    render(<AccountTierBadge tier={tier} />);
    expect(screen.getByText(tier)).toBeInTheDocument();
  });
});
