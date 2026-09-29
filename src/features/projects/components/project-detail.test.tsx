import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDetailView } from "@/features/projects/components/project-detail";
import { projectDetail } from "@/features/projects/components/project-test-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ProjectDetailView", () => {
  it("renders approved overview, summary, links, and booking snapshot", () => {
    render(<ProjectDetailView project={projectDetail()} />);
    expect(screen.getByRole("heading", { name: "Autumn Campaign" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Projects" })).toHaveAttribute(
      "href",
      "/ops/projects",
    );
    expect(screen.getByRole("link", { name: "Edit Project" })).toHaveAttribute(
      "href",
      "/ops/projects/11111111-1111-4111-8111-111111111111/edit",
    );
    expect(screen.getByRole("link", { name: "Blackridge" })).toHaveAttribute(
      "href",
      "/ops/clients/22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByRole("link", { name: /Source enquiry/ })).toHaveAttribute(
      "href",
      "/ops/enquiries/44444444-4444-4444-8444-444444444444",
    );
    expect(screen.getByText("Legacy Booking Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Director, photographer")).toBeInTheDocument();
    expect(screen.getAllByText("R 12 000 - R 18 000")).toHaveLength(2);
  });

  it("switches among overview, plan, and activity tabs", () => {
    render(<ProjectDetailView project={projectDetail()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Plan" }));
    expect(screen.getByRole("heading", { name: "Milestones (1)" })).toBeInTheDocument();
    expect(screen.getByText("Hero film")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText("Project created")).toBeInTheDocument();
  });

  it("omits optional linked and booking sections when absent", () => {
    render(
      <ProjectDetailView
        project={projectDetail({ enquiryId: null, enquiry: null, bookingId: null, booking: null })}
      />,
    );
    expect(screen.queryByText("Legacy Booking Snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Linked Records")).not.toBeInTheDocument();
  });

  it("makes archived projects read-only except for restore", () => {
    render(<ProjectDetailView project={projectDetail({ archived: true })} />);
    expect(screen.queryByRole("link", { name: "Edit Project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Stage" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore Project" })).toBeInTheDocument();
    expect(screen.getByText(/This project is archived/)).toBeInTheDocument();
  });

  it("renders explicit empty operational states", () => {
    render(
      <ProjectDetailView
        project={projectDetail({
          overview: "",
          services: [],
          scheduleNotes: "",
          peopleResources: "",
          tasks: [],
          activity: [],
        })}
      />,
    );
    expect(screen.getByText("No project overview recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No services recorded.")).toBeInTheDocument();
    expect(screen.getByText("No pending tasks.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText("No project activity recorded yet.")).toBeInTheDocument();
  });
});
