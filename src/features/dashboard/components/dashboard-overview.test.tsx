import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import type { DashboardViewModel } from "@/features/dashboard/types";

const dashboard: DashboardViewModel = {
  dateLabel: "Thu, 22 Oct 2026",
  metrics: {
    newEnquiries: 2,
    activeProjects: 1,
    dueFollowUps: 1,
    overdueFollowUps: 0,
    outstandingInvoices: 0,
    outstandingTotal: 0,
  },
  attentionTotal: 2,
  attention: [
    {
      id: "enquiry-1",
      kind: "Enquiry",
      clientName: "Blackridge Hotels",
      service: "Photography",
      currentStage: "New",
      nextAction: "Review brief",
      dueLabel: "Open",
      status: "Needs Attention",
      href: "/ops/enquiries/enquiry-1",
      urgency: 1,
      dueSort: "2026-10-22",
    },
    {
      id: "invoice-1",
      kind: "Invoice",
      clientName: "Lumen Partners",
      service: "Brand Film",
      currentStage: "Sent",
      nextAction: "Record payment",
      dueLabel: "Today",
      status: "Awaiting Payment",
      href: "/ops/invoices/invoice-1",
      urgency: 1,
      dueSort: "2026-10-22",
    },
  ],
  pipeline: [],
  activeRecord: null,
  upcomingFollowUps: [],
  activity: [],
};

describe("DashboardOverview", () => {
  it("renders the personalised greeting and real metrics", () => {
    render(<DashboardOverview dashboard={dashboard} greeting="Good morning, Neo" />);
    expect(screen.getByRole("heading", { name: "Good morning, Neo" })).toBeInTheDocument();
    expect(screen.getByText("New Enquiries")).toBeInTheDocument();
    expect(screen.getByText("Thu, 22 Oct 2026")).toBeInTheDocument();
  });

  it("filters the attention queue using live row fields", () => {
    render(<DashboardOverview dashboard={dashboard} greeting="Good morning, Neo" />);
    fireEvent.change(screen.getByLabelText("Search attention queue"), {
      target: { value: "payment" },
    });
    expect(
      screen.queryByRole("link", { name: /Blackridge Hotels.*Photography/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lumen Partners.*Brand Film/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by item type"), {
      target: { value: "Enquiry" },
    });
    expect(screen.getByText("No queue items match these filters.")).toBeInTheDocument();
  });
});
