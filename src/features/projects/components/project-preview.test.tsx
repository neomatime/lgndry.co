import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectPreview } from "@/features/projects/components/project-preview";
import type { ProjectListItem } from "@/features/projects/types";

const project: ProjectListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Autumn Campaign",
  clientId: "22222222-2222-4222-8222-222222222222",
  clientName: "Blackridge",
  contact: {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Thandi Mokoena",
    email: "thandi@example.com",
    phone: "",
    isPrimary: true,
  },
  projectType: "Film",
  services: ["Film"],
  overview: "A quiet portrait of place.",
  location: "Limpopo",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "Review",
  stagePosition: 0,
  paymentStatus: "Partially Paid",
  deliveryStatus: "Ready for Delivery",
  archived: false,
  createdAt: "2026-09-01T08:00:00Z",
  updatedAt: "2026-09-20T08:00:00Z",
  enquiryId: null,
  bookingId: null,
  tasks: [
    {
      id: "task-1",
      title: "Approve final cut",
      dueDate: "2026-10-04",
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
  ],
  activity: [
    {
      id: "activity-1",
      message: "Project moved to review",
      action: "moved",
      createdAt: "2026-09-20T08:00:00Z",
      relativeTime: "yesterday",
    },
  ],
};

describe("ProjectPreview", () => {
  it("shows the selected project's operational summary", () => {
    render(<ProjectPreview project={project} />);
    const preview = screen.getByRole("complementary", { name: "Autumn Campaign preview" });
    expect(preview).toHaveTextContent("Thandi Mokoena");
    expect(preview).toHaveTextContent("Approve final cut");
    expect(preview).toHaveTextContent("1/1");
    expect(preview).toHaveTextContent("Project moved to review");
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/ops/projects/11111111-1111-4111-8111-111111111111",
    );
  });

  it("uses explicit copy when overview, contact, and tasks are absent", () => {
    render(
      <ProjectPreview
        project={{ ...project, overview: "", contact: null, tasks: [], activity: [] }}
      />,
    );
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
    expect(screen.getByText("No project overview has been added.")).toBeInTheDocument();
    expect(screen.getByText("No pending task")).toBeInTheDocument();
  });
});
