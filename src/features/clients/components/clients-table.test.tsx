import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientsTable } from "@/features/clients/components/clients-table";
import type { ClientListItem } from "@/features/clients/list-view-model";

function row(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Blackridge Hotels",
    type: "Company",
    status: "Active",
    accountTier: "Key Account",
    industry: "Hospitality",
    region: "Limpopo",
    clientSince: "2025-03-01",
    accountOverview: "A long-term hospitality partner.",
    preferredServices: ["Photography", "Film"],
    relationshipNotes: "Prefers morning calls.",
    archived: false,
    createdAt: "2026-09-01T08:00:00Z",
    contacts: [
      {
        id: "contact-1",
        fullName: "Thandi Mokoena",
        roleTitle: "Marketing Director",
        email: "thandi@example.com",
        phone: "0761234567",
        isPrimary: true,
      },
      {
        id: "contact-2",
        fullName: "Kagiso Ndlovu",
        roleTitle: "Producer",
        email: "kagiso@example.com",
        phone: "",
        isPrimary: false,
      },
    ],
    primaryContact: {
      id: "contact-1",
      fullName: "Thandi Mokoena",
      roleTitle: "Marketing Director",
      email: "thandi@example.com",
      phone: "0761234567",
      isPrimary: true,
    },
    enquiries: [
      {
        id: "enquiry-1",
        projectType: "Documentary",
        status: "Reviewing",
        createdAt: "2026-09-27T10:00:00Z",
      },
    ],
    projects: [
      {
        id: "project-1",
        name: "Autumn Campaign",
        status: "Production",
        startDate: "2026-10-01",
        endDate: "2026-10-10",
        deliveryStatus: "In progress",
        archived: false,
      },
    ],
    activity: [
      {
        id: "activity-1",
        message: "Client profile updated",
        createdAt: "2026-09-28T10:00:00Z",
        relativeTime: "yesterday",
      },
    ],
    openEnquiryCount: 2,
    lastActivityAt: "2026-09-29T08:00:00Z",
    ...overrides,
  };
}

describe("ClientsTable", () => {
  it("shows every approved filter with its count", () => {
    render(
      <ClientsTable
        rows={[
          row(),
          row({
            id: "2",
            name: "Lumen Partners",
            status: "Lead",
            accountTier: "Standard",
          }),
          row({ id: "3", name: "Drift Studio", status: "At Risk", archived: true }),
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: "All (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Leads (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Key Accounts (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "At Risk (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Inactive (0)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archived (1)" })).toBeInTheDocument();
  });

  it("searches secondary contacts", () => {
    render(
      <ClientsTable
        rows={[row(), row({ id: "2", name: "Lumen Partners", contacts: [], primaryContact: null })]}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search clients..."), {
      target: { value: "kagiso" },
    });
    expect(screen.getByText("Blackridge Hotels")).toBeInTheDocument();
    expect(screen.queryByText("Lumen Partners")).not.toBeInTheDocument();
  });

  it.each([
    ["Newest", "Lumen Partners"],
    ["Oldest", "Blackridge Hotels"],
    ["Name A-Z", "Blackridge Hotels"],
    ["Name Z-A", "Lumen Partners"],
  ])("sorts by %s", (label, firstName) => {
    render(
      <ClientsTable
        rows={[
          row(),
          row({
            id: "2",
            name: "Lumen Partners",
            createdAt: "2026-09-20T08:00:00Z",
          }),
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Sort clients"), {
      target: { value: screen.getByRole("option", { name: label }).getAttribute("value") },
    });
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]!).getByText(firstName)).toBeInTheDocument();
  });

  it("reveals only the checked client's preview", () => {
    render(<ClientsTable rows={[row(), row({ id: "2", name: "Lumen Partners" })]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Preview Blackridge Hotels" }));
    expect(screen.getByRole("region", { name: "Blackridge Hotels preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Preview Lumen Partners" }));
    expect(
      screen.queryByRole("region", { name: "Blackridge Hotels preview" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Lumen Partners preview" })).toBeInTheDocument();
  });

  it("shows recent enquiries and activity in the selected preview", () => {
    render(<ClientsTable rows={[row()]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Preview Blackridge Hotels" }));
    const preview = screen.getByRole("region", { name: "Blackridge Hotels preview" });
    expect(within(preview).getByRole("heading", { name: "Recent Enquiries" })).toBeInTheDocument();
    expect(within(preview).getByRole("link", { name: "Documentary" })).toHaveAttribute(
      "href",
      "/ops/enquiries/enquiry-1",
    );
    expect(within(preview).getByText("Client profile updated")).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: "Recent Projects" })).toBeInTheDocument();
    expect(within(preview).getByRole("link", { name: "Autumn Campaign" })).toHaveAttribute(
      "href",
      "/ops/projects/project-1",
    );
  });

  it("uses real links for detail and edit actions", () => {
    render(<ClientsTable rows={[row()]} />);
    expect(screen.getByText("Blackridge Hotels").closest("a")).toHaveAttribute(
      "href",
      "/ops/clients/11111111-1111-1111-1111-111111111111",
    );
    expect(screen.getByRole("link", { name: "View Blackridge Hotels" })).toHaveAttribute(
      "href",
      "/ops/clients/11111111-1111-1111-1111-111111111111",
    );
    expect(screen.getByRole("link", { name: "Edit Blackridge Hotels" })).toHaveAttribute(
      "href",
      "/ops/clients/11111111-1111-1111-1111-111111111111/edit",
    );
  });

  it("renders archived state without replacing the client's stored status", () => {
    render(<ClientsTable rows={[row({ status: "At Risk", archived: true })]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Archived (1)" }));
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit Blackridge Hotels" })).not.toBeInTheDocument();
  });

  it("shows an empty result message", () => {
    render(<ClientsTable rows={[row()]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Leads (0)" }));
    expect(screen.getByText("No clients match this filter.")).toBeInTheDocument();
  });

  it("formats dates in the Johannesburg time zone", () => {
    render(<ClientsTable rows={[row({ lastActivityAt: "2026-09-28T22:30:00Z" })]} />);
    expect(screen.getByText("29 Sept 2026")).toBeInTheDocument();
  });
});
