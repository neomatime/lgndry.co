import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientForm } from "@/features/clients/components/client-form";
import type { ClientInput } from "@/features/clients/types";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/clients/actions", () => ({
  createClient: mocks.createClient,
  updateClient: mocks.updateClient,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const CLIENT_ID = "11111111-1111-1111-1111-111111111111";

function fillRequiredIndividual() {
  fireEvent.change(screen.getByLabelText("Client name"), {
    target: { value: "Nandi Dlamini" },
  });
  fireEvent.change(screen.getByLabelText("Contact 1 full name"), {
    target: { value: "Nandi Dlamini" },
  });
  fireEvent.change(screen.getByLabelText("Contact 1 email"), {
    target: { value: "NANDI@example.com " },
  });
}

function editValue(): ClientInput & { id: string } {
  return {
    id: CLIENT_ID,
    name: "Blackridge Hotels",
    type: "Company",
    status: "Active",
    accountTier: "Key Account",
    industry: "Hospitality",
    region: "Limpopo",
    clientSince: "2025-03-01",
    accountOverview: "Seasonal campaigns.",
    preferredServices: ["Photography"],
    relationshipNotes: "Prefers morning calls.",
    contacts: [
      {
        id: "223e4567-e89b-42d3-a456-426614174001",
        fullName: "Thandi Mokoena",
        roleTitle: "Marketing Director",
        email: "thandi@example.com",
        phone: "0761234567",
        isPrimary: true,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ status: "success", clientId: CLIENT_ID });
  mocks.updateClient.mockResolvedValue({ status: "success", clientId: CLIENT_ID });
});

describe("ClientForm", () => {
  it("renders create defaults and every profile field", () => {
    render(<ClientForm mode="create" />);
    expect(screen.getByLabelText("Client type")).toHaveValue("Individual");
    expect(screen.getByLabelText("Relationship status")).toHaveValue("Lead");
    expect(screen.getByLabelText("Account tier")).toHaveValue("Standard");
    expect(screen.getByLabelText("Client since")).not.toHaveValue("");
    for (const label of [
      "Client name",
      "Industry",
      "Region",
      "Account overview",
      "Preferred services",
      "Relationship notes",
      "Contact 1 full name",
      "Contact 1 role or title",
      "Contact 1 email",
      "Contact 1 phone",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("adds, reorders, changes primary, and removes contacts", () => {
    render(<ClientForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Contact 1 full name"), {
      target: { value: "First Contact" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Contact" }));
    fireEvent.change(screen.getByLabelText("Contact 2 full name"), {
      target: { value: "Second Contact" },
    });

    expect(screen.getByRole("button", { name: "Remove contact 1" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("radio", { name: "Primary contact" })[1]!);
    expect(screen.getByRole("button", { name: "Remove contact 1" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Move contact 2 up" }));
    expect(screen.getByLabelText("Contact 1 full name")).toHaveValue("Second Contact");
    fireEvent.click(screen.getByRole("button", { name: "Remove contact 2" }));
    expect(screen.queryByLabelText("Contact 2 full name")).not.toBeInTheDocument();
  });

  it("requires role or title for companies", () => {
    render(<ClientForm mode="create" />);
    fillRequiredIndividual();
    fireEvent.change(screen.getByLabelText("Client type"), { target: { value: "Company" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Client" }));

    expect(screen.getByText("Role or title is required for company contacts.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("allows an individual without a role and submits normalized values", async () => {
    render(<ClientForm mode="create" />);
    fillRequiredIndividual();
    fireEvent.click(screen.getByRole("button", { name: "Create Client" }));

    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledOnce());
    expect(mocks.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Nandi Dlamini",
        type: "Individual",
        contacts: [
          expect.objectContaining({ email: "NANDI@example.com", roleTitle: "", isPrimary: true }),
        ],
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith(`/ops/clients/${CLIENT_ID}`);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("adds, deduplicates, and removes preferred services", () => {
    render(<ClientForm mode="create" />);
    const input = screen.getByLabelText("Preferred services");
    fireEvent.change(input, { target: { value: "Photography" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Photography")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "photography" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("That preferred service is already listed.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Photography" }));
    expect(screen.queryByText("Photography")).not.toBeInTheDocument();
  });

  it("retains values and links to an existing client after a conflict", async () => {
    mocks.createClient.mockResolvedValue({
      status: "conflict",
      clientId: "33333333-3333-3333-3333-333333333333",
      error: "That email belongs to another active client.",
    });
    render(<ClientForm mode="create" />);
    fillRequiredIndividual();
    fireEvent.click(screen.getByRole("button", { name: "Create Client" }));

    const link = await screen.findByRole("link", { name: "View existing client" });
    expect(link).toHaveAttribute("href", "/ops/clients/33333333-3333-3333-3333-333333333333");
    expect(screen.getByLabelText("Client name")).toHaveValue("Nandi Dlamini");
  });

  it("announces a generic action failure and retains values", async () => {
    mocks.createClient.mockResolvedValue({ status: "error", error: "Please try again." });
    render(<ClientForm mode="create" />);
    fillRequiredIndividual();
    fireEvent.click(screen.getByRole("button", { name: "Create Client" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
    expect(screen.getByLabelText("Client name")).toHaveValue("Nandi Dlamini");
  });

  it("prevents duplicate submission while save is pending", async () => {
    let resolve: (value: { status: "success"; clientId: string }) => void = () => undefined;
    mocks.createClient.mockImplementation(
      () => new Promise((done) => (resolve = done as typeof resolve)),
    );
    render(<ClientForm mode="create" />);
    fillRequiredIndividual();
    const submit = screen.getByRole("button", { name: "Create Client" });
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    await act(async () => resolve({ status: "success", clientId: CLIENT_ID }));
  });

  it("prefills edit values, preserves contact ids, and updates", async () => {
    render(<ClientForm mode="edit" initialValue={editValue()} />);
    expect(screen.getByLabelText("Client name")).toHaveValue("Blackridge Hotels");
    expect(screen.getByLabelText("Contact 1 role or title")).toHaveValue("Marketing Director");
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/ops/clients/${CLIENT_ID}`,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.updateClient).toHaveBeenCalledOnce());
    expect(mocks.updateClient).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({
        contacts: [expect.objectContaining({ id: "223e4567-e89b-42d3-a456-426614174001" })],
      }),
    );
  });

  it("keeps the primary contact removal control disabled until another is selected", () => {
    render(<ClientForm mode="edit" initialValue={editValue()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Contact" }));
    const firstContact = screen.getByRole("group", { name: "Contact 1" });
    expect(within(firstContact).getByRole("button", { name: "Remove contact 1" })).toBeDisabled();
  });
});
