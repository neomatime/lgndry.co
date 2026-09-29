import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectArchiveControl } from "@/features/projects/components/project-archive-control";

const { archiveMock, refreshMock } = vi.hoisted(() => ({
  archiveMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/features/projects/actions", () => ({ setProjectArchived: archiveMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

beforeEach(() => {
  vi.clearAllMocks();
  archiveMock.mockResolvedValue({
    status: "success",
    projectId: "11111111-1111-4111-8111-111111111111",
  });
});

describe("ProjectArchiveControl", () => {
  it("requires confirmation before archiving", async () => {
    render(
      <ProjectArchiveControl
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Autumn Campaign"
        archived={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive Project" }));
    expect(screen.getByText("Archive Autumn Campaign?")).toBeInTheDocument();
    expect(archiveMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Archive" }));
    await waitFor(() =>
      expect(archiveMock).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", true),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("offers restore and preserves confirmation on failure", async () => {
    archiveMock.mockResolvedValue({ status: "error", message: "Could not restore." });
    render(
      <ProjectArchiveControl
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Autumn Campaign"
        archived
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore Project" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Restore" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not restore.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
