import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnquiryStatusControl } from "@/features/enquiries/components/enquiry-status-control";

const mocks = vi.hoisted(() => ({ setStatus: vi.fn(), refresh: vi.fn() }));

vi.mock("@/features/enquiries/actions", () => ({ setEnquiryStatus: mocks.setStatus }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const enquiryId = "11111111-1111-4111-8111-111111111111";

describe("EnquiryStatusControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setStatus.mockResolvedValue({ status: "success", enquiryId });
  });

  it("persists a manual status and refreshes", async () => {
    render(<EnquiryStatusControl enquiryId={enquiryId} status="New" />);
    expect(screen.getByRole("button", { name: "Update Status" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Enquiry status"), {
      target: { value: "Reviewing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(enquiryId, "Reviewing"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByText("Enquiry status updated.")).toBeInTheDocument();
  });

  it("does not offer project-managed statuses", () => {
    render(<EnquiryStatusControl enquiryId={enquiryId} status="New" />);
    expect(screen.queryByRole("option", { name: "Booked" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "In Production" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Completed" })).not.toBeInTheDocument();
  });

  it("links to a project if a concurrent conversion owns status", async () => {
    mocks.setStatus.mockResolvedValue({
      status: "conflict",
      projectId: "22222222-2222-4222-8222-222222222222",
      message: "This enquiry's status is managed by its linked project.",
    });
    render(<EnquiryStatusControl enquiryId={enquiryId} status="New" />);
    fireEvent.change(screen.getByLabelText("Enquiry status"), { target: { value: "Closed" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      "/ops/projects/22222222-2222-4222-8222-222222222222",
    );
  });
});
