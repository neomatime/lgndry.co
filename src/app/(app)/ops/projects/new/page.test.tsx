import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewProjectPage from "@/app/(app)/ops/projects/new/page";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  conversion: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  options: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/projects/fetch-project-conversion", () => ({
  fetchProjectConversion: mocks.conversion,
}));
vi.mock("@/features/projects/fetch-project-form-options", () => ({
  fetchProjectFormOptions: mocks.options,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/projects/components/project-form", () => ({
  ProjectForm: ({ mode }: { mode: string }) => <div>Project form: {mode}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin" });
  mocks.options.mockResolvedValue([]);
});
const props = (enquiry?: string) => ({ searchParams: Promise.resolve(enquiry ? { enquiry } : {}) });

describe("NewProjectPage", () => {
  it("loads standalone form options after authentication", async () => {
    render(await NewProjectPage(props()));
    expect(mocks.auth).toHaveBeenCalledBefore(mocks.options);
    expect(screen.getByText("Project form: create")).toBeInTheDocument();
  });

  it("renders conversion, conflict, invalid, error, and not-found states", async () => {
    mocks.conversion.mockResolvedValue({ status: "conflict", projectId: "project-1" });
    render(await NewProjectPage(props("11111111-1111-4111-8111-111111111111")));
    expect(screen.getByRole("link", { name: "Open the existing project" })).toHaveAttribute(
      "href",
      "/ops/projects/project-1",
    );

    mocks.conversion.mockResolvedValue({ status: "invalid", message: "Closed enquiry." });
    render(await NewProjectPage(props("22222222-2222-4222-8222-222222222222")));
    expect(screen.getByText("Closed enquiry.")).toBeInTheDocument();

    mocks.conversion.mockResolvedValue({ status: "error" });
    render(await NewProjectPage(props("33333333-3333-4333-8333-333333333333")));
    expect(screen.getByText("This enquiry is temporarily unavailable")).toBeInTheDocument();

    mocks.conversion.mockResolvedValue({ status: "not-found" });
    await expect(NewProjectPage(props("bad"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
