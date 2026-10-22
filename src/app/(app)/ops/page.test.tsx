import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterPage from "@/app/(app)/ops/page";

const { fetchDashboardDataMock, requireOpsUserMock, buildDashboardViewModelMock } = vi.hoisted(
  () => ({
    fetchDashboardDataMock: vi.fn(),
    requireOpsUserMock: vi.fn(),
    buildDashboardViewModelMock: vi.fn(),
  }),
);

vi.mock("@/features/dashboard/fetch-dashboard", () => ({
  fetchDashboardData: fetchDashboardDataMock,
}));
vi.mock("@/features/dashboard/view-model", () => ({
  buildDashboardViewModel: buildDashboardViewModelMock,
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: requireOpsUserMock }));
vi.mock("@/features/dashboard/components/dashboard-overview", () => ({
  DashboardOverview: () => <div>Live Command Center dashboard</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireOpsUserMock.mockResolvedValue({ id: "admin" });
});

describe("CommandCenterPage", () => {
  it("authenticates before loading the dashboard", async () => {
    const order: string[] = [];
    requireOpsUserMock.mockImplementation(async () => order.push("auth"));
    fetchDashboardDataMock.mockImplementation(async () => {
      order.push("fetch");
      return {};
    });
    buildDashboardViewModelMock.mockReturnValue({});

    render(await CommandCenterPage());

    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByText("Live Command Center dashboard")).toBeInTheDocument();
  });

  it("renders a distinct unavailable state when aggregation fails", async () => {
    fetchDashboardDataMock.mockResolvedValue(null);

    render(await CommandCenterPage());

    expect(screen.getByText("The Command Center is temporarily unavailable")).toBeInTheDocument();
  });
});
