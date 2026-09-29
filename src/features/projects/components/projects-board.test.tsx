import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProjectsBoard } from "@/features/projects/components/projects-board";
import type { ProjectListItem } from "@/features/projects/types";

const { moveProjectMock } = vi.hoisted(() => ({ moveProjectMock: vi.fn() }));

vi.mock("@/features/projects/actions", () => ({ moveProject: moveProjectMock }));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onDragEnd({
            active: { id: "11111111-1111-4111-8111-111111111111" },
            over: { id: "column:Production" },
          })
        }
      >
        Simulate drag
      </button>
      {children}
    </div>
  ),
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: () => undefined } } }));

const row = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Autumn Campaign",
  clientId: "22222222-2222-4222-8222-222222222222",
  clientName: "Blackridge",
  contact: {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Thandi Mokoena",
    email: "thandi@example.com",
    phone: "",
    isPrimary: true,
  },
  projectType: "Film",
  services: ["Film"],
  overview: "A quiet portrait.",
  location: "Limpopo",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "Planning",
  stagePosition: 0,
  paymentStatus: "Deposit Pending",
  deliveryStatus: "Not Ready",
  archived: false,
  createdAt: "2026-09-01T08:00:00Z",
  updatedAt: "2026-09-20T08:00:00Z",
  enquiryId: null,
  bookingId: null,
  tasks: [],
  deliverables: [],
  activity: [],
  ...overrides,
});

const rows = [
  row({ stagePosition: 1 }),
  row({
    id: "22222222-2222-4222-8222-222222222222",
    name: "First in Planning",
    stagePosition: 0,
  }),
  row({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Production Film",
    status: "Production",
    clientId: "44444444-4444-4444-8444-444444444444",
    clientName: "Lumen Partners",
    projectType: "Documentary",
    paymentStatus: "Paid",
  }),
  row({
    id: "55555555-5555-4555-8555-555555555555",
    name: "Zulu Completed",
    status: "Completed",
    createdAt: "2026-09-10T08:00:00Z",
  }),
  row({
    id: "66666666-6666-4666-8666-666666666666",
    name: "Alpha Completed",
    status: "Completed",
    createdAt: "2026-09-20T08:00:00Z",
  }),
  row({
    id: "77777777-7777-4777-8777-777777777777",
    name: "Archived Work",
    archived: true,
  }),
];

beforeEach(() => {
  moveProjectMock.mockReset();
  moveProjectMock.mockResolvedValue({ status: "success", projectId: rows[0]!.id });
});

describe("ProjectsBoard", () => {
  it("shows view counts, all columns, and saved stage order", () => {
    render(<ProjectsBoard rows={rows} />);
    expect(screen.getByRole("tab", { name: "Active (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Completed (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archived (1)" })).toBeInTheDocument();
    const planning = screen.getByRole("region", { name: "Planning projects" });
    const links = within(planning).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["First in Planning", "Autumn Campaign"]);
    expect(screen.getByRole("region", { name: "Delivery projects" })).toHaveTextContent(
      "No projects",
    );
  });

  it("searches and filters across project context", () => {
    render(<ProjectsBoard rows={rows} />);
    fireEvent.change(screen.getByPlaceholderText("Search projects..."), {
      target: { value: "lumen" },
    });
    expect(screen.getByText("Production Film")).toBeInTheDocument();
    expect(screen.queryByText("Autumn Campaign")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search projects..."), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by payment status"), {
      target: { value: "Paid" },
    });
    expect(screen.getByText("Production Film")).toBeInTheDocument();
    expect(screen.queryByText("Autumn Campaign")).not.toBeInTheDocument();
  });

  it("shows sorted terminal and archived tables", () => {
    render(<ProjectsBoard rows={rows} />);
    fireEvent.click(screen.getByRole("tab", { name: "Completed (2)" }));
    fireEvent.change(screen.getByLabelText("Sort projects"), { target: { value: "name" } });
    const tableRows = screen.getAllByRole("row").slice(1);
    expect(within(tableRows[0]!).getByText("Alpha Completed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Archived (1)" }));
    expect(screen.getByRole("link", { name: "Archived Work" })).toBeInTheDocument();
  });

  it("opens the preview for only the checked project", () => {
    render(<ProjectsBoard rows={rows} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Preview Autumn Campaign" }));
    expect(
      screen.getByRole("complementary", { name: "Autumn Campaign preview" }),
    ).toBeInTheDocument();
  });

  it("persists a menu move and keeps the optimistic result", async () => {
    render(<ProjectsBoard rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Autumn Campaign" }));
    fireEvent.click(screen.getByRole("button", { name: "Production" }));

    await waitFor(() => expect(moveProjectMock).toHaveBeenCalledWith(rows[0]!.id, "Production", 1));
    expect(
      within(screen.getByRole("region", { name: "Production projects" })).getByText(
        "Autumn Campaign",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Project stage updated.")).toBeInTheDocument();
  });

  it("rolls back a failed optimistic move", async () => {
    moveProjectMock.mockResolvedValue({ status: "error", message: "Could not move project." });
    render(<ProjectsBoard rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Autumn Campaign" }));
    fireEvent.click(screen.getByRole("button", { name: "Production" }));

    await waitFor(() => expect(screen.getByText("Could not move project.")).toBeInTheDocument());
    expect(
      within(screen.getByRole("region", { name: "Planning projects" })).getByText(
        "Autumn Campaign",
      ),
    ).toBeInTheDocument();
  });

  it("persists a drag to the destination column", async () => {
    render(<ProjectsBoard rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate drag" }));
    await waitFor(() => expect(moveProjectMock).toHaveBeenCalledWith(rows[0]!.id, "Production", 1));
  });

  it("shows a clear no-results state", () => {
    render(<ProjectsBoard rows={rows} />);
    fireEvent.change(screen.getByPlaceholderText("Search projects..."), {
      target: { value: "nothing matches this" },
    });
    expect(screen.getByText("No projects match this view.")).toBeInTheDocument();
  });
});
