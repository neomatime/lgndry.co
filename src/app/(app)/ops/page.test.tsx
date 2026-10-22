import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterPage from "@/app/(app)/ops/page";

const {
  fetchDashboardDataMock,
  requireOpsUserMock,
  buildDashboardViewModelMock,
  dashboardGreetingMock,
} = vi.hoisted(() => ({
  fetchDashboardDataMock: vi.fn(),
  requireOpsUserMock: vi.fn(),
  buildDashboardViewModelMock: vi.fn(),
  dashboardGreetingMock: vi.fn(),
}));

vi.mock("@/features/dashboard/fetch-dashboard", () => ({
  fetchDashboardData: fetchDashboardDataMock,
}));
vi.mock("@/features/dashboard/view-model", () => ({
  buildDashboardViewModel: buildDashboardViewModelMock,
  dashboardGreeting: dashboardGreetingMock,
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: requireOpsUserMock }));
vi.mock("@/features/dashboard/components/dashboard-overview", () => ({
  DashboardOverview: ({ greeting }: { greeting: string }) => <div>{greeting}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireOpsUserMock.mockResolvedValue({ id: "admin", name: "Neo Matime" });
  dashboardGreetingMock.mockReturnValue("Good morning, Neo");
});

describe("CommandCenterPage", () => {
  it("authenticates before loading the dashboard", async () => {
    const order: string[] = [];
    requireOpsUserMock.mockImplementation(async () => {
      order.push("auth");
      return { id: "admin", name: "Neo Matime" };
    });
    fetchDashboardDataMock.mockImplementation(async () => {
      order.push("fetch");
      return {};
    });
    buildDashboardViewModelMock.mockReturnValue({});

    render(await CommandCenterPage());

    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByText("Good morning, Neo")).toBeInTheDocument();
    expect(dashboardGreetingMock).toHaveBeenCalledWith("Neo Matime", expect.any(Date));
  });

  it("renders a distinct unavailable state when aggregation fails", async () => {
    fetchDashboardDataMock.mockResolvedValue(null);

    render(await CommandCenterPage());

    expect(screen.getByText("The Command Center is temporarily unavailable")).toBeInTheDocument();
  });
});
