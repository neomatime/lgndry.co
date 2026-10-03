import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDetailView as BaseProjectDetailView } from "@/features/projects/components/project-detail";
import { projectDetail } from "@/features/projects/components/project-test-data";
import type { ProjectDetail } from "@/features/projects/types";
import { parentFollowUps, sampleFollowUpRows } from "@/features/follow-ups/related-test-data";
import type { ParentFollowUps } from "@/features/follow-ups/related-view-model";

/** The follow-ups tab is covered below; every other test renders it empty. */
function ProjectDetailView({
  project,
  followUps,
}: {
  project: ProjectDetail;
  followUps?: ParentFollowUps;
}) {
  return (
    <BaseProjectDetailView
      project={project}
      followUps={
        followUps ?? parentFollowUps([], { archived: project.archived, clientId: project.clientId })
      }
    />
  );
}

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

describe("ProjectDetailView follow-ups", () => {
  const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
  const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
  const live = { archived: false, clientId: CLIENT_ID, clientArchived: false };

  it("adds a Follow-ups tab with a count that lists the project's follow-ups", () => {
    render(
      <ProjectDetailView
        project={projectDetail()}
        followUps={parentFollowUps(sampleFollowUpRows(), live)}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-open",
    );
    expect(screen.getByRole("heading", { name: "Open (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed (1)" })).toBeInTheDocument();
  });

  it("preselects the project's client and the project, never the source enquiry", () => {
    render(<ProjectDetailView project={projectDetail()} followUps={parentFollowUps([], live)} />);
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (0)" }));
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/new?clientId=${CLIENT_ID}&projectId=${PROJECT_ID}`,
    );
  });

  it("shows a friendly empty state", () => {
    render(<ProjectDetailView project={projectDetail()} followUps={parentFollowUps([], live)} />);
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (0)" }));
    expect(screen.getByText(/No follow-ups are linked to this project yet/)).toBeInTheDocument();
  });

  it("keeps an archived project's follow-up history but does not offer to add", () => {
    render(
      <ProjectDetailView
        project={projectDetail({ archived: true })}
        followUps={parentFollowUps(sampleFollowUpRows(), { ...live, archived: true })}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/This project is archived, so new follow-ups/)).toBeInTheDocument();
  });

  it("does not offer to add when the project's client is archived", () => {
    render(
      <ProjectDetailView
        project={projectDetail()}
        followUps={parentFollowUps(sampleFollowUpRows(), { ...live, clientArchived: true })}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/This client is archived/)).toBeInTheDocument();
  });
});
