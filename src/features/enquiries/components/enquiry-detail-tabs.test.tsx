import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnquiryDetailTabs as BaseEnquiryDetailTabs } from "@/features/enquiries/components/enquiry-detail-tabs";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { parentFollowUps, sampleFollowUpRows } from "@/features/follow-ups/related-test-data";
import type { ParentFollowUps } from "@/features/follow-ups/related-view-model";

/** The follow-ups tab is covered below; every other test renders it empty. */
function EnquiryDetailTabs({
  enquiry,
  followUps,
}: {
  enquiry: EnquiryDetail;
  followUps?: ParentFollowUps;
}) {
  return <BaseEnquiryDetailTabs enquiry={enquiry} followUps={followUps ?? parentFollowUps()} />;
}

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

describe("EnquiryDetailTabs follow-ups", () => {
  const live = { archived: false, clientId: "client-9", clientArchived: false };

  it("shows a Follow-ups tab with a count, between the existing tabs", () => {
    render(
      <EnquiryDetailTabs
        enquiry={detail()}
        followUps={parentFollowUps(sampleFollowUpRows(), live)}
      />,
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Attachments (1)",
      "Follow-ups (2)",
      "Activity (1)",
    ]);
  });

  it("lists the enquiry-linked follow-ups and preselects the enquiry's client and the enquiry", () => {
    render(
      <EnquiryDetailTabs
        enquiry={detail({ id: "e1" })}
        followUps={parentFollowUps(sampleFollowUpRows(), live)}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-open",
    );
    expect(screen.getByRole("heading", { name: "Completed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/new?clientId=client-9&enquiryId=e1",
    );
  });

  it("shows a friendly empty state, distinct from a failure", () => {
    render(<EnquiryDetailTabs enquiry={detail()} followUps={parentFollowUps([], live)} />);
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (0)" }));
    expect(screen.getByText(/No follow-ups are linked to this enquiry yet/)).toBeInTheDocument();
  });

  it("does not offer Add for an enquiry with no client, and says why", () => {
    render(
      <EnquiryDetailTabs
        enquiry={detail()}
        followUps={parentFollowUps(sampleFollowUpRows(), { ...live, clientId: null })}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/isn't linked to one/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toBeInTheDocument();
  });

  it("keeps an archived enquiry's history but does not offer Add", () => {
    render(
      <EnquiryDetailTabs
        enquiry={detail()}
        followUps={parentFollowUps(sampleFollowUpRows(), { ...live, archived: true })}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/This enquiry is archived/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thank the client" })).toBeInTheDocument();
  });

  it("does not offer Add when the enquiry's client is archived", () => {
    render(
      <EnquiryDetailTabs
        enquiry={detail()}
        followUps={parentFollowUps(sampleFollowUpRows(), { ...live, clientArchived: true })}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Follow-ups (2)" }));
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/This client is archived/)).toBeInTheDocument();
  });
});
