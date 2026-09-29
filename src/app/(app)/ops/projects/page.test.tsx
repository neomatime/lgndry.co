import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(app)/ops/projects/page";

const { fetchProjectsMock, requireOpsUserMock } = vi.hoisted(() => ({
  fetchProjectsMock: vi.fn(),
  requireOpsUserMock: vi.fn(),
}));

vi.mock("@/features/projects/fetch-projects", () => ({ fetchProjects: fetchProjectsMock }));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: requireOpsUserMock }));
vi.mock("@/features/projects/components/projects-board", () => ({
  ProjectsBoard: ({ rows }: { rows: unknown[] }) => <div>Project board: {rows.length}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireOpsUserMock.mockResolvedValue({ id: "admin" });
});

describe("ProjectsPage", () => {
  it("authenticates before fetching data and renders the unavailable state", async () => {
    const order: string[] = [];
    requireOpsUserMock.mockImplementation(async () => order.push("auth"));
    fetchProjectsMock.mockImplementation(async () => {
      order.push("fetch");
      return null;
    });
    render(await ProjectsPage());
    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByText("Projects are temporarily unavailable")).toBeInTheDocument();
  });

  it("renders a useful empty state with the create action", async () => {
    fetchProjectsMock.mockResolvedValue([]);
    render(await ProjectsPage());
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Project" })).toHaveAttribute(
      "href",
      "/ops/projects/new",
    );
  });

  it("renders factual summary cards and the board", async () => {
    fetchProjectsMock.mockResolvedValue([
      {
        status: "Production",
        deliveryStatus: "Ready for Delivery",
        archived: false,
      },
      { status: "Review", deliveryStatus: "Not Ready", archived: false },
    ]);
    render(await ProjectsPage());
    expect(screen.getByText("Active Projects")).toBeInTheDocument();
    expect(screen.getByText("In Production")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Approval")).toBeInTheDocument();
    expect(screen.getByText("Ready for Delivery")).toBeInTheDocument();
    expect(screen.getByText("Project board: 2")).toBeInTheDocument();
  });
});
