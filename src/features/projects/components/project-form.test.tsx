import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/features/projects/components/project-form";
import { projectDetail } from "@/features/projects/components/project-test-data";
import { projectDetailToInput } from "@/features/projects/detail-view-model";
import type { ProjectClientOption } from "@/features/projects/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  convert: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/projects/actions", () => ({
  createProject: mocks.create,
  convertEnquiryToProject: mocks.convert,
  updateProject: mocks.update,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const clients: ProjectClientOption[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Blackridge",
    contacts: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        fullName: "Thandi",
        email: "thandi@example.com",
        phone: "",
        isPrimary: true,
      },
    ],
  },
  { id: "99999999-9999-4999-8999-999999999999", name: "Lumen", contacts: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  const success = { status: "success", projectId: "11111111-1111-4111-8111-111111111111" };
  mocks.create.mockResolvedValue(success);
  mocks.convert.mockResolvedValue(success);
  mocks.update.mockResolvedValue(success);
});

function fillCreate() {
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "New Film" } });
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: clients[0]!.id } });
}

describe("ProjectForm", () => {
  it("renders all form sections and resets contact when client changes", () => {
    render(
      <ProjectForm
        mode="edit"
        clients={clients}
        projectId={projectDetail().id}
        initialValue={projectDetailToInput(projectDetail())}
      />,
    );
    expect(screen.getByLabelText("Client contact")).toHaveValue(clients[0]!.contacts[0]!.id);
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: clients[1]!.id } });
    expect(screen.getByLabelText("Client contact")).toHaveValue("");
    for (const heading of [
      "Profile",
      "Schedule",
      "Production",
      "Financial Snapshot",
      "Production Plan",
    ])
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("validates dates and budget before calling the action", () => {
    render(<ProjectForm mode="create" clients={clients} />);
    fillCreate();
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Budget minimum"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Budget maximum"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    expect(screen.getByText("End date cannot be before the start date.")).toBeInTheDocument();
    expect(
      screen.getByText("Maximum budget cannot be below the minimum budget."),
    ).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("submits standalone create and redirects", async () => {
    render(<ProjectForm mode="create" clients={clients} />);
    fillCreate();
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith("/ops/projects/11111111-1111-4111-8111-111111111111");
  });

  it("locks conversion client, shows source references, and requires confirmation", async () => {
    const value = projectDetailToInput(projectDetail());
    render(
      <ProjectForm
        mode="conversion"
        clients={[clients[0]!]}
        initialValue={value}
        enquiryId="44444444-4444-4444-8444-444444444444"
        sourceTimeline="Spring"
        sourceBudget="R20k-R30k"
      />,
    );
    expect(screen.getByLabelText("Client")).toBeDisabled();
    expect(screen.getByText("Source timeline: Spring")).toBeInTheDocument();
    expect(screen.getByText("Source budget: R20k-R30k")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    expect(screen.getByText("Confirm that the enquiry will be marked Booked.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    await waitFor(() =>
      expect(mocks.convert).toHaveBeenCalledWith(
        "44444444-4444-4444-8444-444444444444",
        expect.any(Object),
      ),
    );
  });

  it("updates edits and links conversion conflicts", async () => {
    mocks.update.mockResolvedValue({
      status: "conflict",
      projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      message: "Already exists.",
    });
    render(
      <ProjectForm
        mode="edit"
        clients={clients}
        projectId={projectDetail().id}
        initialValue={projectDetailToInput(projectDetail())}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("link", { name: "Open existing project" })).toHaveAttribute(
      "href",
      "/ops/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(mocks.update).toHaveBeenCalledWith(projectDetail().id, expect.any(Object));
  });
});
