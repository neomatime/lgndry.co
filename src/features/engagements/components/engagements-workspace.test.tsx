import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EngagementsWorkspace } from "./engagements-workspace";
import type { EngagementData } from "../types";

const data: EngagementData = {
  bookings: [
    {
      kind: "booking",
      id: "00000000-0000-4000-8000-000000000001",
      client: { id: "c1", name: "North Studio", email: "n@example.com", phone: null },
      contact: null,
      service: "Portrait Session",
      services: ["Portraiture"],
      date: "2026-10-23",
      start: "10:00",
      location: "Johannesburg",
      projectDetails: "Editorial portraits",
      dateFlexibility: "Flexible",
      budgetRange: "R10,000",
      status: "New",
      deposit: "Not Requested",
      ownerName: null,
      ownerEmail: null,
      version: 1,
      createdAt: "2026-10-20T10:00:00Z",
    },
    {
      kind: "booking",
      id: "00000000-0000-4000-8000-000000000002",
      client: { id: "c2", name: "South Studio", email: "s@example.com", phone: null },
      contact: null,
      service: "Brand Session",
      services: ["Brand Photography"],
      date: "2026-10-24",
      start: "14:00",
      location: "Pretoria",
      projectDetails: null,
      dateFlexibility: null,
      budgetRange: null,
      status: "Confirmed",
      deposit: "Paid",
      ownerName: "Neo",
      ownerEmail: null,
      version: 2,
      createdAt: "2026-10-21T10:00:00Z",
    },
  ],
  partnerships: [
    {
      kind: "partnership",
      id: "00000000-0000-4000-8000-000000000003",
      client: null,
      contact: null,
      company: "Field House",
      partnershipType: "Creative Partnership",
      focusAreas: ["Brand Storytelling"],
      brandGoals: "Launch campaign",
      industry: "Hospitality",
      brandLink: null,
      brandLocation: "Limpopo",
      contentFrequency: "Monthly",
      contactRole: null,
      budgetRange: null,
      status: "Reviewing",
      ownerName: null,
      ownerEmail: null,
      version: 1,
      createdAt: "2026-10-22T10:00:00Z",
    },
  ],
};

describe("EngagementsWorkspace", () => {
  it("switches between booking, partnership and internal calendar views", () => {
    render(<EngagementsWorkspace data={data} today="2026-10-23" />);
    expect(screen.getByText("North Studio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "partnerships" }));
    expect(screen.getByText("Field House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "calendar" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Tentative").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
  });

  it("filters the active queue by text", () => {
    render(<EngagementsWorkspace data={data} today="2026-10-23" />);
    fireEvent.change(screen.getByPlaceholderText("Search records..."), {
      target: { value: "south" },
    });
    expect(screen.queryByText("North Studio")).not.toBeInTheDocument();
    expect(screen.getByText("South Studio")).toBeInTheDocument();
  });
});
