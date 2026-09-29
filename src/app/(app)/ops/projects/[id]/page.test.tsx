import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage, { generateMetadata } from "@/app/(app)/ops/projects/[id]/page";
import { projectDetail } from "@/features/projects/components/project-test-data";

const { fetchMock, notFoundMock, requireOpsUserMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requireOpsUserMock: vi.fn(),
}));

vi.mock("@/features/projects/fetch-project-detail", () => ({ fetchProjectDetail: fetchMock }));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: requireOpsUserMock }));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireOpsUserMock.mockResolvedValue({ id: "admin" });
});

const props = (id = "11111111-1111-4111-8111-111111111111") => ({
  params: Promise.resolve({ id }),
});

describe("ProjectDetailPage", () => {
  it("authenticates before loading detail and renders the project", async () => {
    const order: string[] = [];
    requireOpsUserMock.mockImplementation(async () => order.push("auth"));
    fetchMock.mockImplementation(async () => {
      order.push("fetch");
      return { status: "ok", project: projectDetail() };
    });
    render(await ProjectDetailPage(props()));
    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByRole("heading", { name: "Autumn Campaign" })).toBeInTheDocument();
  });

  it("authenticates metadata and uses the project name", async () => {
    fetchMock.mockResolvedValue({ status: "ok", project: projectDetail() });
    expect(await generateMetadata(props())).toEqual({ title: "Autumn Campaign Project" });
    expect(requireOpsUserMock).toHaveBeenCalledBefore(fetchMock);
  });

  it("returns a 404 for malformed or missing ids", async () => {
    fetchMock.mockResolvedValue({ status: "not-found" });
    await expect(ProjectDetailPage(props("not-a-real-id"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders a distinct temporary error state", async () => {
    fetchMock.mockResolvedValue({ status: "error" });
    render(await ProjectDetailPage(props()));
    expect(screen.getByText("This project is temporarily unavailable")).toBeInTheDocument();
  });
});
