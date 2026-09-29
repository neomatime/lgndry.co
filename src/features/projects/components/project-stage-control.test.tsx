import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectStageControl } from "@/features/projects/components/project-stage-control";

const { moveProjectMock, refreshMock } = vi.hoisted(() => ({
  moveProjectMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/features/projects/actions", () => ({ moveProject: moveProjectMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

beforeEach(() => {
  vi.clearAllMocks();
  moveProjectMock.mockResolvedValue({
    status: "success",
    projectId: "11111111-1111-4111-8111-111111111111",
  });
});

describe("ProjectStageControl", () => {
  it("persists a selected stage and refreshes", async () => {
    render(
      <ProjectStageControl
        projectId="11111111-1111-4111-8111-111111111111"
        status="Planning"
        stagePosition={2}
      />,
    );
    expect(screen.getByRole("button", { name: "Update Stage" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Project stage"), { target: { value: "Production" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Stage" }));
    await waitFor(() =>
      expect(moveProjectMock).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        "Production",
        2_147_483_647,
      ),
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(screen.getByText("Project stage updated.")).toBeInTheDocument();
  });

  it("keeps the control stable on failure", async () => {
    moveProjectMock.mockResolvedValue({ status: "error", message: "Could not update." });
    render(
      <ProjectStageControl
        projectId="11111111-1111-4111-8111-111111111111"
        status="Planning"
        stagePosition={0}
      />,
    );
    fireEvent.change(screen.getByLabelText("Project stage"), { target: { value: "Review" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Stage" }));
    expect(await screen.findByText("Could not update.")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
