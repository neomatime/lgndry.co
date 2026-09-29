import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditProjectPage, { generateMetadata } from "@/app/(app)/ops/projects/[id]/edit/page";
import { projectDetail } from "@/features/projects/components/project-test-data";
import { projectDetailToInput } from "@/features/projects/detail-view-model";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  fetch: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/projects/fetch-project-form-options", () => ({
  fetchProjectFormData: mocks.fetch,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/features/projects/components/project-form", () => ({
  ProjectForm: ({ mode }: { mode: string }) => <div>Project form: {mode}</div>,
}));

const id = "11111111-1111-4111-8111-111111111111";
const ok = (archived = false) => ({
  status: "ok",
  clients: [],
  project: { id, archived, values: projectDetailToInput(projectDetail()) },
});
const props = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin" });
});

describe("EditProjectPage", () => {
  it("loads editable values after authentication and generates metadata", async () => {
    mocks.fetch.mockResolvedValue(ok());
    render(await EditProjectPage(props));
    expect(mocks.auth).toHaveBeenCalledBefore(mocks.fetch);
    expect(screen.getByText("Project form: edit")).toBeInTheDocument();
    expect(await generateMetadata(props)).toEqual({ title: "Edit Autumn Campaign" });
  });

  it("handles not-found, error, and archived records", async () => {
    mocks.fetch.mockResolvedValue({ status: "error" });
    render(await EditProjectPage(props));
    expect(screen.getByText("This project is temporarily unavailable")).toBeInTheDocument();
    mocks.fetch.mockResolvedValue({ status: "not-found" });
    await expect(EditProjectPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.fetch.mockResolvedValue(ok(true));
    await expect(EditProjectPage(props)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(`/ops/projects/${id}`);
  });
});
