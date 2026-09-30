import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnquiryForm } from "@/features/enquiries/components/enquiry-form";

const mocks = vi.hoisted(() => ({ update: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/features/enquiries/actions", () => ({ updateEnquiry: mocks.update }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const enquiryId = "11111111-1111-4111-8111-111111111111";
const initialValue = {
  fullName: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  projectType: "Documentary" as const,
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
};

describe("EnquiryForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ status: "success", enquiryId });
  });

  it("saves edited enquiry details and returns to the record", async () => {
    render(<EnquiryForm enquiryId={enquiryId} initialValue={initialValue} />);
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Tzaneen" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        enquiryId,
        expect.objectContaining({ location: "Tzaneen" }),
      ),
    );
    expect(mocks.push).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
  });

  it("shows local validation without calling the server", () => {
    render(<EnquiryForm enquiryId={enquiryId} initialValue={initialValue} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted enquiry details");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps entered values and reports a save failure", async () => {
    mocks.update.mockResolvedValue({ status: "error", message: "Could not save." });
    render(<EnquiryForm enquiryId={enquiryId} initialValue={initialValue} />);
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Neo Matime" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Could not save.")).toBeInTheDocument();
    expect(screen.getByLabelText("Contact name")).toHaveValue("Neo Matime");
  });
});
