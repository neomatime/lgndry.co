import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPlan } from "@/features/projects/components/project-plan";
import { projectDetail } from "@/features/projects/components/project-test-data";

const { deliverableMock, milestoneMock, refreshMock, taskMock } = vi.hoisted(() => ({
  deliverableMock: vi.fn(),
  milestoneMock: vi.fn(),
  refreshMock: vi.fn(),
  taskMock: vi.fn(),
}));

vi.mock("@/features/projects/actions", () => ({
  setProjectDeliverableStatus: deliverableMock,
  setProjectMilestoneCompleted: milestoneMock,
  setProjectTaskCompleted: taskMock,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [deliverableMock, milestoneMock, taskMock]) {
    mock.mockResolvedValue({
      status: "success",
      projectId: "11111111-1111-4111-8111-111111111111",
    });
  }
});

describe("ProjectPlan", () => {
  it("updates milestone, task, and deliverable status", async () => {
    render(<ProjectPlan project={projectDetail()} />);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Complete milestone Treatment approved" }),
    );
    await waitFor(() =>
      expect(milestoneMock).toHaveBeenCalledWith("66666666-6666-4666-8666-666666666666", true),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete task Confirm access" }));
    await waitFor(() =>
      expect(taskMock).toHaveBeenCalledWith("77777777-7777-4777-8777-777777777777", true),
    );
    fireEvent.change(screen.getByLabelText("Status for Hero film"), {
      target: { value: "Ready" },
    });
    await waitFor(() =>
      expect(deliverableMock).toHaveBeenCalledWith("88888888-8888-4888-8888-888888888888", "Ready"),
    );
    expect(refreshMock).toHaveBeenCalledTimes(3);
  });

  it("reports a failed quick action without refreshing", async () => {
    taskMock.mockResolvedValue({ status: "error", message: "Could not update task." });
    render(<ProjectPlan project={projectDetail()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete task Confirm access" }));
    expect(await screen.findByText("Could not update task.")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders archived plans without write controls", () => {
    render(<ProjectPlan project={projectDetail({ archived: true })} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders clear empty states", () => {
    render(
      <ProjectPlan
        project={projectDetail({ milestones: [], tasks: [], deliverables: [], activity: [] })}
      />,
    );
    expect(screen.getByText("No milestones recorded.")).toBeInTheDocument();
    expect(screen.getByText("No tasks recorded.")).toBeInTheDocument();
    expect(screen.getByText("No deliverables recorded.")).toBeInTheDocument();
  });
});
