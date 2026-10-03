import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditFollowUpPage, { generateMetadata } from "@/app/(app)/ops/follow-ups/[id]/edit/page";
import type { FollowUpInput } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  form: vi.fn(),
  detail: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/follow-ups/fetch-follow-up-form-data", () => ({
  fetchFollowUpFormData: mocks.form,
}));
vi.mock("@/features/follow-ups/fetch-follow-up-detail", () => ({
  fetchFollowUpDetail: mocks.detail,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/features/follow-ups/components/follow-up-form", () => ({
  FollowUpForm: ({ existingFollowUp }: { existingFollowUp: { version: number } }) => (
    <div>Follow-up form: edit v{existingFollowUp.version}</div>
  ),
}));

const id = "11111111-1111-4111-8111-111111111111";
const ok = {
  status: "ok",
  clients: [],
  followUp: { id, version: 7, values: { title: "Chase the quote" } as FollowUpInput },
};
const props = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin" });
  mocks.form.mockResolvedValue(ok);
  mocks.detail.mockResolvedValue({ status: "ok", followUp: { status: "Open" } });
});

describe("EditFollowUpPage", () => {
  it("authenticates first, loads editable values and the version, and sets metadata", async () => {
    render(await EditFollowUpPage(props));
    expect(mocks.auth).toHaveBeenCalledBefore(mocks.form);
    expect(screen.getByText("Follow-up form: edit v7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit Chase the quote" })).toBeInTheDocument();
    expect(await generateMetadata(props)).toEqual({ title: "Edit Chase the quote" });
  });

  it("falls back to a generic title in metadata when the follow-up cannot load", async () => {
    mocks.form.mockResolvedValue({ status: "not-found" });
    expect(await generateMetadata(props)).toEqual({ title: "Edit Follow-up" });
  });

  it("returns 404 for a missing or malformed follow-up", async () => {
    mocks.form.mockResolvedValue({ status: "not-found" });
    await expect(EditFollowUpPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows a temporary-failure state when the data cannot load", async () => {
    mocks.form.mockResolvedValue({ status: "error" });
    render(await EditFollowUpPage(props));
    expect(screen.getByText("This follow-up is temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Follow-up form/)).not.toBeInTheDocument();
  });

  it.each(["Completed", "Cancelled"])(
    "sends a %s follow-up back to its read-only detail page",
    async (status) => {
      mocks.detail.mockResolvedValue({ status: "ok", followUp: { status } });
      await expect(EditFollowUpPage(props)).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.redirect).toHaveBeenCalledWith(`/ops/follow-ups/${id}`);
    },
  );
});
