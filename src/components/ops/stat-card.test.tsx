import { render, screen } from "@testing-library/react";
import { Mail } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "@/components/ops/stat-card";

describe("StatCard", () => {
  it("renders the label and a numeric value", () => {
    render(<StatCard icon={Mail} label="New Enquiries" value={8} />);
    expect(screen.getByText("New Enquiries")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders any node as the value, not just a number", () => {
    render(<StatCard icon={Mail} label="Status" value={<span>Awaiting Review</span>} />);
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
  });
});
