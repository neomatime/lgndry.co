import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import type { ProjectListItem } from "@/features/projects/types";

const row = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Autumn Campaign",
  clientId: "22222222-2222-4222-8222-222222222222",
  clientName: "Blackridge",
  contact: null,
  projectType: "Film",
  services: [],
  overview: "",
  location: "",
  startDate: "2026-09-28",
  endDate: "",
  status: "Completed",
  stagePosition: 0,
  paymentStatus: "Paid",
  deliveryStatus: "Delivered",
  archived: false,
  createdAt: "2026-09-01T08:00:00Z",
  updatedAt: "2026-09-20T08:00:00Z",
  enquiryId: null,
  bookingId: null,
  tasks: [],
  deliverables: [],
  activity: [],
  ...overrides,
});

describe("ProjectsTable", () => {
  it("renders project links and Johannesburg dates", () => {
    render(<ProjectsTable rows={[row()]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Autumn Campaign" })).toHaveAttribute(
      "href",
      "/ops/projects/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("28 Sept 2026")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("selects exactly the requested project", () => {
    const onSelect = vi.fn();
    render(<ProjectsTable rows={[row()]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Preview Autumn Campaign" }));
    expect(onSelect).toHaveBeenCalledWith(row().id);
  });
});
