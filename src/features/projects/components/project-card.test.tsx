import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectCard } from "@/features/projects/components/project-card";
import type { ProjectListItem } from "@/features/projects/types";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: () => undefined } } }));

function row(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Autumn Campaign",
    clientId: "22222222-2222-4222-8222-222222222222",
    clientName: "Blackridge",
    contact: null,
    projectType: "Film",
    services: ["Film"],
    overview: "A quiet portrait.",
    location: "Limpopo",
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    status: "Planning",
    stagePosition: 0,
    paymentStatus: "Deposit Pending",
    deliveryStatus: "Not Ready",
    archived: false,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-20T08:00:00Z",
    enquiryId: null,
    bookingId: null,
    tasks: [
      {
        id: "task-1",
        title: "Confirm access",
        dueDate: "2026-09-30",
        isCompleted: false,
        sortOrder: 0,
        completedAt: null,
      },
    ],
    deliverables: [
      {
        id: "deliverable-1",
        title: "Hero film",
        dueDate: "",
        status: "Delivered",
        sortOrder: 0,
        completedAt: null,
      },
      {
        id: "deliverable-2",
        title: "Stills",
        dueDate: "",
        status: "Ready",
        sortOrder: 1,
        completedAt: null,
      },
    ],
    activity: [],
    ...overrides,
  };
}

describe("ProjectCard", () => {
  it("renders a real detail link and production context", () => {
    render(<ProjectCard project={row()} selected={false} onSelect={vi.fn()} onMove={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Autumn Campaign" })).toHaveAttribute(
      "href",
      "/ops/projects/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("Confirm access")).toBeInTheDocument();
    expect(screen.getByText("1/2 delivered")).toBeInTheDocument();
    expect(screen.getByText("01 Oct 2026")).toBeInTheDocument();
  });

  it("selects the card and exposes a non-drag stage menu", () => {
    const onSelect = vi.fn();
    const onMove = vi.fn();
    render(<ProjectCard project={row()} selected={false} onSelect={onSelect} onMove={onMove} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Preview Autumn Campaign" }));
    expect(onSelect).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Move Autumn Campaign" }));
    fireEvent.click(screen.getByRole("button", { name: "Production" }));
    expect(onMove).toHaveBeenCalledWith("Production");
  });
});
