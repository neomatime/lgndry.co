import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditEnquiryPage from "@/app/(app)/ops/enquiries/[id]/edit/page";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { buildRelatedFollowUps } from "@/features/follow-ups/related-view-model";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  requireOpsUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/features/enquiries/fetch-enquiry-detail", () => ({
  fetchEnquiryDetail: mocks.fetch,
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.requireOpsUser }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const id = "11111111-1111-4111-8111-111111111111";
const detail: EnquiryDetail = {
  id,
  fullName: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  projectType: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  status: "New",
  source: "Website",
  createdAt: "2026-09-27T10:00:00Z",
  attachments: [],
  activity: [],
  project: null,
  clientId: "22222222-2222-4222-8222-222222222222",
  archived: false,
  clientArchived: false,
  followUps: buildRelatedFollowUps([], new Date("2026-09-30T08:00:00Z")),
};
const props = { params: Promise.resolve({ id }) };

describe("EditEnquiryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOpsUser.mockResolvedValue({ id: "admin" });
  });

  it("requires OPS access and pre-fills the enquiry form", async () => {
    mocks.fetch.mockResolvedValue({ status: "ok", enquiry: detail });
    render(await EditEnquiryPage(props));
    expect(mocks.requireOpsUser).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "Edit Blackridge Hotels Enquiry" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contact name")).toHaveValue("Thandi Mokoena");
    expect(screen.getByLabelText("Description")).toHaveValue("A short documentary series.");
  });

  it("returns a 404 for a missing enquiry", async () => {
    mocks.fetch.mockResolvedValue({ status: "not-found" });
    await expect(EditEnquiryPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("shows a distinct unavailable state for fetch failures", async () => {
    mocks.fetch.mockResolvedValue({ status: "error" });
    render(await EditEnquiryPage(props));
    expect(screen.getByText("This enquiry is temporarily unavailable")).toBeInTheDocument();
  });
});
