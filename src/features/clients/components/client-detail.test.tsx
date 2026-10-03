import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientDetailView } from "@/features/clients/components/client-detail";
import type { ClientDetail } from "@/features/clients/detail-view-model";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";
import { buildRelatedFollowUps } from "@/features/follow-ups/related-view-model";

vi.mock("@/features/clients/components/client-archive-control", () => ({
  ClientArchiveControl: ({ archived }: { archived: boolean }) => (
    <button>{archived ? "Restore Client" : "Archive Client"}</button>
  ),
}));

function fixture(overrides: Partial<ClientDetail> = {}): ClientDetail {
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
        roleTitle: "",
        email: "kagiso@example.com",
        phone: "",
        isPrimary: false,
      },
    ],
    enquiries: [
      {
        id: "22222222-2222-2222-2222-222222222222",
        projectType: "Documentary",
        status: "Reviewing",
        createdAt: "2026-09-27T10:00:00Z",
      },
    ],
    projects: [
      {
        id: "33333333-3333-3333-3333-333333333333",
        name: "Autumn Campaign",
        status: "Production",
        startDate: "2026-10-01",
        endDate: "2026-10-10",
        deliveryStatus: "In progress",
        archived: false,
      },
    ],
    openEnquiryCount: 1,
    activity: [
      {
        id: "activity-1",
        message: "Client profile updated",
        createdAt: "2026-09-28T10:00:00Z",
        relativeTime: "yesterday",
      },
    ],
    followUps: buildRelatedFollowUps([], new Date("2026-09-30T08:00:00Z")),
    ...overrides,
  };
}

const CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const followUps = buildRelatedFollowUps(
  [
    followUpDetail({
      id: "fu-open",
      title: "Chase the autumn quote",
      dueDate: "2026-10-05",
      dueTime: "",
    }),
    followUpDetail({
      id: "fu-done",
      title: "Thank the client",
      status: "Completed",
      completedAt: "2026-09-29T08:00:00Z",
    }),
  ],
  new Date("2026-09-30T08:00:00Z"),
);

describe("ClientDetailView", () => {
  it("renders every approved data panel", () => {
    render(<ClientDetailView client={fixture()} />);

    expect(screen.getByRole("heading", { name: "Account Overview" })).toBeInTheDocument();
    expect(screen.getByText("A long-term hospitality partner.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preferred Services / Scope" })).toBeInTheDocument();
    expect(screen.getByText("Photography")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Linked Enquiries (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Linked Projects (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Relationship Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Client Details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contacts (2)" })).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent Activity" })).toBeInTheDocument();
    expect(screen.getByText("Client profile updated")).toBeInTheDocument();
  });

  it("links projects to their project record", () => {
    render(<ClientDetailView client={fixture()} />);
    expect(screen.getByRole("link", { name: "Autumn Campaign" })).toHaveAttribute(
      "href",
      "/ops/projects/33333333-3333-3333-3333-333333333333",
    );
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("links enquiries and renders their existing status badge", () => {
    render(<ClientDetailView client={fixture()} />);
    expect(screen.getByRole("link", { name: "22222222" })).toHaveAttribute(
      "href",
      "/ops/enquiries/22222222-2222-2222-2222-222222222222",
    );
    expect(screen.getByText("Reviewing")).toBeInTheDocument();
  });

  it("uses email and phone links and omits an empty contact role", () => {
    render(<ClientDetailView client={fixture()} />);
    expect(screen.getByRole("link", { name: "thandi@example.com" })).toHaveAttribute(
      "href",
      "mailto:thandi@example.com",
    );
    expect(screen.getByRole("link", { name: "0761234567" })).toHaveAttribute(
      "href",
      "tel:0761234567",
    );
    expect(screen.getByText("Kagiso Ndlovu").parentElement).not.toHaveTextContent("undefined");
  });

  it("does not invent panels for unfinished modules", () => {
    render(<ClientDetailView client={fixture()} />);
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("Financial Snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Communication Snapshot")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New Project" })).not.toBeInTheDocument();
  });

  it("hides Edit Client and offers Restore Client for archived records", () => {
    render(<ClientDetailView client={fixture({ archived: true })} />);
    expect(screen.queryByRole("link", { name: "Edit Client" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore Client" })).toBeInTheDocument();
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("renders quiet empty states for optional content", () => {
    render(
      <ClientDetailView
        client={fixture({
          accountOverview: null,
          preferredServices: [],
          relationshipNotes: null,
          contacts: [],
          enquiries: [],
          projects: [],
          activity: [],
          openEnquiryCount: 0,
        })}
      />,
    );
    expect(screen.getByText("No account overview recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No preferred services recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No enquiries are linked to this client.")).toBeInTheDocument();
    expect(screen.getByText("No projects are linked to this client.")).toBeInTheDocument();
    expect(screen.getByText("No relationship notes recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No contacts recorded.")).toBeInTheDocument();
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });
});

describe("ClientDetailView follow-ups", () => {
  it("lists every linked follow-up in a headed section with an Add Follow-up link", () => {
    render(<ClientDetailView client={fixture({ followUps })} />);
    expect(screen.getByRole("heading", { name: "Follow-ups (2)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-open",
    );
    expect(screen.getByRole("link", { name: "Thank the client" })).toHaveAttribute(
      "href",
      "/ops/follow-ups/fu-done",
    );
    expect(screen.getByRole("heading", { name: "Open (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/new?clientId=${CLIENT_ID}`,
    );
  });

  it("shows a friendly empty state and still offers to add one", () => {
    render(<ClientDetailView client={fixture()} />);
    expect(screen.getByRole("heading", { name: "Follow-ups (0)" })).toBeInTheDocument();
    expect(screen.getByText(/No follow-ups are linked to this client yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Follow-up" })).toBeInTheDocument();
  });

  it("keeps the history of an archived client but does not offer to add", () => {
    render(<ClientDetailView client={fixture({ archived: true, followUps })} />);
    expect(screen.getByRole("heading", { name: "Follow-ups (2)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chase the autumn quote" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add Follow-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/This client is archived, so new follow-ups/)).toBeInTheDocument();
  });
});
