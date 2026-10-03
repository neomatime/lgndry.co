import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FollowUpPreview } from "@/features/follow-ups/components/follow-up-preview";
import type { FollowUpListItem } from "@/features/follow-ups/types";

function followUp(overrides: Partial<FollowUpListItem> = {}): FollowUpListItem {
  return {
    id: "fu-1",
    reference: "FUP-0001",
    clientId: "client-1",
    clientName: "Blackridge Hotels",
    contact: {
      id: "contact-1",
      fullName: "James Mitchell",
      email: "james@example.com",
      phone: "",
      role: "Head of Marketing",
    },
    related: { id: "enquiry-1", label: "Documentary", kind: "Enquiry" },
    followUpType: "Client Check-in",
    customType: "",
    displayType: "Client Check-in",
    title: "Check in",
    overview: "",
    notes: "",
    dueDate: "2026-09-30",
    dueTime: "",
    priority: "Medium",
    contactMethods: [],
    status: "Open",
    scheduleState: "Upcoming",
    outcome: "",
    cancellationReason: "",
    completedAt: null,
    cancelledAt: null,
    owner: { id: "u", name: "", email: "" },
    seriesId: null,
    occurrenceNumber: 1,
    successorId: null,
    version: 1,
    createdAt: "2026-09-20T08:00:00Z",
    updatedAt: "2026-09-20T08:00:00Z",
    checklist: [],
    ...overrides,
  };
}

describe("FollowUpPreview", () => {
  it("links to the follow-up, the client and the related record", () => {
    render(<FollowUpPreview followUp={followUp()} />);
    const preview = screen.getByRole("region", { name: "FUP-0001 preview" });
    expect(within(preview).getByRole("link", { name: "View Follow-up" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-1",
    );
    expect(within(preview).getByRole("link", { name: "Blackridge Hotels" })).toHaveAttribute(
      "href",
      "/ops/clients/client-1",
    );
    expect(within(preview).getByRole("link", { name: "Documentary" })).toHaveAttribute(
      "href",
      "/ops/enquiries/enquiry-1",
    );
  });

  it("routes a related project to the project page", () => {
    render(
      <FollowUpPreview
        followUp={followUp({ related: { id: "project-9", label: "Autumn", kind: "Project" } })}
      />,
    );
    expect(screen.getByRole("link", { name: "Autumn" })).toHaveAttribute(
      "href",
      "/ops/projects/project-9",
    );
  });

  it("falls back gracefully when optional details are missing", () => {
    render(<FollowUpPreview followUp={followUp({ related: null })} />);
    expect(screen.getByText("No overview has been added.")).toBeInTheDocument();
    expect(screen.getByText("No checklist items.")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Documentary" })).not.toBeInTheDocument();
  });

  it("converts the completion timestamp to its Johannesburg day", () => {
    // 22:30 UTC on 29 September is already 30 September in Johannesburg.
    render(
      <FollowUpPreview
        followUp={followUp({
          status: "Completed",
          scheduleState: "Completed",
          completedAt: "2026-09-29T22:30:00Z",
          outcome: "All agreed.",
        })}
      />,
    );
    const completed = screen.getByText("Completed", { selector: "dt" });
    expect(completed.nextElementSibling).toHaveTextContent("Wed, 30 Sep 2026");
    expect(screen.getByText("All agreed.")).toBeInTheDocument();
  });
});
