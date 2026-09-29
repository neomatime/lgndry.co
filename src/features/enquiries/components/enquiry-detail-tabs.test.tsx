import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnquiryDetailTabs } from "@/features/enquiries/components/enquiry-detail-tabs";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";

function detail(over: Partial<EnquiryDetail> = {}): EnquiryDetail {
  return {
    id: "e1",
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
    attachments: [
      { fileName: "brief.pdf", sizeBytes: 2_400_000, url: "https://signed.example/brief.pdf" },
    ],
    activity: [
      { id: "a1", message: "New project enquiry from Thandi Mokoena", relativeTime: "2 hours ago" },
    ],
    project: null,
    ...over,
  };
}

describe("EnquiryDetailTabs", () => {
  it("shows the Overview tab's content by default, including the project type pill", () => {
    render(<EnquiryDetailTabs enquiry={detail()} />);
    expect(screen.getByText("A short documentary series.")).toBeInTheDocument();
    expect(screen.getByText("Documentary")).toBeInTheDocument();
  });

  it("shows the attachment count in the tab label and a working link on the Attachments tab", () => {
    render(<EnquiryDetailTabs enquiry={detail()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Attachments \(1\)/ }));
    const link = screen.getByRole("link", { name: "brief.pdf" });
    expect(link).toHaveAttribute("href", "https://signed.example/brief.pdf");
  });

  it("shows every activity entry on the Activity tab", () => {
    render(<EnquiryDetailTabs enquiry={detail()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("New project enquiry from Thandi Mokoena")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity", () => {
    render(<EnquiryDetailTabs enquiry={detail({ activity: [] })} />);
    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("shows a real empty state on the Attachments tab when there are none", () => {
    render(<EnquiryDetailTabs enquiry={detail({ attachments: [] })} />);
    fireEvent.click(screen.getByRole("tab", { name: /Attachments \(0\)/ }));
    expect(screen.getByText("No attachments.")).toBeInTheDocument();
  });
});
