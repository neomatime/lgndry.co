import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EnquiryDetailPage from "@/app/(app)/ops/enquiries/[id]/page";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { parentFollowUps, sampleFollowUpRows } from "@/features/follow-ups/related-test-data";

const { fetchMock, requireOpsUserMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  requireOpsUserMock: vi.fn(),
}));

vi.mock("@/features/enquiries/fetch-enquiry-detail-page", () => ({
  fetchEnquiryDetailPage: fetchMock,
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: requireOpsUserMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  requireOpsUserMock.mockResolvedValue({ id: "admin" });
});

function enquiry(overrides: Partial<EnquiryDetail> = {}): EnquiryDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
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
    ...overrides,
  };
}

const props = { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) };

describe("EnquiryDetailPage project action", () => {
  it("offers editing and manual status management", async () => {
    fetchMock.mockResolvedValue({
      status: "ok",
      enquiry: enquiry(),
      followUps: parentFollowUps(),
    });
    render(await EnquiryDetailPage(props));
    expect(screen.getByRole("link", { name: "Edit Enquiry" })).toHaveAttribute(
      "href",
      "/ops/enquiries/11111111-1111-4111-8111-111111111111/edit",
    );
    expect(screen.getByLabelText("Enquiry status")).toBeInTheDocument();
  });

  it("offers conversion for an eligible unconverted enquiry", async () => {
    fetchMock.mockResolvedValue({
      status: "ok",
      enquiry: enquiry(),
      followUps: parentFollowUps(),
    });
    render(await EnquiryDetailPage(props));
    expect(screen.getByRole("link", { name: "Create Project" })).toHaveAttribute(
      "href",
      "/ops/projects/new?enquiry=11111111-1111-4111-8111-111111111111",
    );
  });

  it("opens the existing project after conversion", async () => {
    fetchMock.mockResolvedValue({
      status: "ok",
      enquiry: enquiry({
        status: "Booked",
        project: { id: "project-1", name: "Autumn Campaign", status: "Production" },
      }),
      followUps: parentFollowUps(),
    });
    render(await EnquiryDetailPage(props));
    expect(screen.getByRole("link", { name: "Open Project" })).toHaveAttribute(
      "href",
      "/ops/projects/project-1",
    );
    expect(screen.queryByRole("link", { name: "Create Project" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Enquiry status")).not.toBeInTheDocument();
    expect(screen.getByText("This status is managed by the linked project.")).toBeInTheDocument();
  });

  it.each(["Completed", "Closed"] as const)(
    "does not offer conversion for a %s enquiry",
    async (status) => {
      fetchMock.mockResolvedValue({
        status: "ok",
        enquiry: enquiry({ status }),
        followUps: parentFollowUps(),
      });
      render(await EnquiryDetailPage(props));
      expect(screen.queryByRole("link", { name: "Create Project" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Open Project" })).not.toBeInTheDocument();
    },
  );
});

describe("EnquiryDetailPage follow-ups", () => {
  it("shows the Follow-ups tab with the enquiry-linked follow-ups and an add link", async () => {
    fetchMock.mockResolvedValue({
      status: "ok",
      enquiry: enquiry(),
      followUps: parentFollowUps(sampleFollowUpRows()),
    });
    render(await EnquiryDetailPage(props));
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-open",
    );
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/new?clientId=22222222-2222-4222-8222-222222222222&enquiryId=11111111-1111-4111-8111-111111111111",
    );
  });

  it("shows an empty tab for no follow-ups, but the unavailable state when loading fails", async () => {
    fetchMock.mockResolvedValue({
      status: "ok",
      enquiry: enquiry(),
      followUps: parentFollowUps(),
    });
    const { unmount } = render(await EnquiryDetailPage(props));
    expect(screen.getByRole("tab", { name: "Follow-ups (0)" })).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValue({ status: "error" });
    render(await EnquiryDetailPage(props));
    expect(screen.getByText("This enquiry is temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Follow-ups/ })).not.toBeInTheDocument();
  });
});
