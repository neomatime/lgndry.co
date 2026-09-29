import { describe, expect, it } from "vitest";
import {
  buildBoard,
  filterProjects,
  getDeliverableProgress,
  getNextAction,
  moveProjectOptimistically,
  sortProjects,
  summarizeProjects,
} from "@/features/projects/list-view-model";
import type { ProjectListItem, ProjectStatus } from "@/features/projects/types";

const row = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Autumn Campaign",
  clientId: "22222222-2222-4222-8222-222222222222",
  clientName: "Blackridge Hotels",
  contact: {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "James Mitchell",
    email: "james@example.com",
    phone: "",
    isPrimary: true,
  },
  projectType: "Documentary",
  services: ["Photography"],
  overview: "Mountain campaign",
  location: "Limpopo",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "Planning",
  stagePosition: 0,
  paymentStatus: "Deposit Pending",
  deliveryStatus: "Not Ready",
  archived: false,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  enquiryId: null,
  bookingId: null,
  tasks: [],
  deliverables: [],
  activity: [],
  ...overrides,
});

describe("project list view model", () => {
  it("summarizes active production, review, and delivery readiness", () => {
    const rows = [
      row(),
      row({ id: "2", status: "Production" }),
      row({ id: "3", status: "Review" }),
      row({ id: "4", status: "Delivery", deliveryStatus: "Ready for Delivery" }),
      row({ id: "5", status: "Completed" }),
    ];
    expect(summarizeProjects(rows)).toEqual({
      active: 4,
      inProduction: 1,
      awaitingApproval: 1,
      readyForDelivery: 1,
    });
  });

  it("orders every active board column by saved position", () => {
    const board = buildBoard([
      row({ id: "later", stagePosition: 2 }),
      row({ id: "first", stagePosition: 0 }),
      row({ id: "production", status: "Production" }),
    ]);
    expect(board.Planning.map((item) => item.id)).toEqual(["first", "later"]);
    expect(board.Production[0]?.id).toBe("production");
  });

  it("filters by lifecycle, fields, and contact search", () => {
    const rows = [row(), row({ id: "done", status: "Completed", clientName: "Elsewhere" })];
    expect(filterProjects(rows, { view: "Active", search: "james" })).toHaveLength(1);
    expect(filterProjects(rows, { view: "Completed", search: "" })[0]?.id).toBe("done");
    expect(
      filterProjects(rows, {
        view: "Active",
        search: "",
        paymentStatus: "Paid",
      }),
    ).toHaveLength(0);
  });

  it("sorts by board order and project name", () => {
    const rows = [
      row({ id: "b", name: "Zulu", status: "Production", stagePosition: 0 }),
      row({ id: "a", name: "Alpha", status: "Planning", stagePosition: 1 }),
    ];
    expect(sortProjects(rows, "board").map((item) => item.id)).toEqual(["a", "b"]);
    expect(sortProjects(rows, "name").map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("calculates deliverable progress and the earliest pending action", () => {
    const project = row({
      deliverables: [
        { id: "1", title: "A", dueDate: "", status: "Delivered", sortOrder: 0, completedAt: null },
        { id: "2", title: "B", dueDate: "", status: "Ready", sortOrder: 1, completedAt: null },
      ],
      tasks: [
        {
          id: "1",
          title: "Later",
          dueDate: "2026-10-03",
          isCompleted: false,
          sortOrder: 0,
          completedAt: null,
        },
        {
          id: "2",
          title: "Sooner",
          dueDate: "2026-10-01",
          isCompleted: false,
          sortOrder: 1,
          completedAt: null,
        },
      ],
    });
    expect(getDeliverableProgress(project)).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(getNextAction(project)?.title).toBe("Sooner");
  });

  it("moves a project optimistically and reindexes both columns", () => {
    const board = buildBoard([
      row({ id: "one", stagePosition: 0 }),
      row({ id: "two", stagePosition: 1 }),
      row({ id: "three", status: "Production", stagePosition: 0 }),
    ]);
    const moved = moveProjectOptimistically(board, "two", "Production", 0);
    expect(moved.Planning.map((item) => [item.id, item.stagePosition])).toEqual([["one", 0]]);
    expect(moved.Production.map((item) => [item.id, item.stagePosition])).toEqual([
      ["two", 0],
      ["three", 1],
    ]);
  });

  it.each(["Planning", "Pre-Production", "Production", "Review", "Delivery"])(
    "recognizes %s as active",
    (status) => {
      expect(summarizeProjects([row({ status: status as ProjectStatus })]).active).toBe(1);
    },
  );
});
