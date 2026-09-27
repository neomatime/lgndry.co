import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ops/status-badge";

describe("StatusBadge", () => {
  it("renders the status text for every real status value", () => {
    const statuses = [
      "New",
      "Reviewing",
      "Quoted",
      "Follow-up",
      "Booked",
      "In Production",
      "Completed",
      "Closed",
    ] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    }
  });

  it("gives New the filled treatment", () => {
    render(<StatusBadge status="New" />);
    expect(screen.getByText("New").className).toContain("bg-ink");
  });

  it("gives an in-progress status the neutral filled treatment", () => {
    render(<StatusBadge status="Reviewing" />);
    expect(screen.getByText("Reviewing").className).toContain("bg-line");
  });

  it("gives a terminal status the quieter outline treatment", () => {
    render(<StatusBadge status="Closed" />);
    expect(screen.getByText("Closed").className).toContain("text-ink-muted");
  });
});
