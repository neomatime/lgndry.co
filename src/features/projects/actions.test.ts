import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOpsUser: vi.fn(),
  createServer: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.requireOpsUser }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  convertEnquiryToProject,
  createProject,
  moveProject,
  setProjectArchived,
  setProjectDeliverableStatus,
  setProjectMilestoneCompleted,
  setProjectTaskCompleted,
  updateProject,
} from "@/features/projects/actions";

const projectId = "123e4567-e89b-42d3-a456-426614174000";
const enquiryId = "223e4567-e89b-42d3-a456-426614174000";
const clientId = "323e4567-e89b-42d3-a456-426614174000";
const itemId = "423e4567-e89b-42d3-a456-426614174000";
const input = {
  name: "Autumn Campaign",
  clientId,
  clientContactId: "",
  projectType: "Film",
  services: ["Photography"],
  overview: "Overview",
  location: "Limpopo",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  scheduleNotes: "Notes",
  peopleResources: "Crew",
  budgetMin: "1000",
  budgetMax: "2000",
  currency: "ZAR",
  paymentStatus: "Deposit Pending",
  deliveryStatus: "Not Ready",
  status: "Planning",
  milestones: [{ title: "Kickoff", description: "", dueDate: "", status: "Pending" }],
  tasks: [{ title: "Confirm brief", dueDate: "", isCompleted: false }],
  deliverables: [{ title: "Final film", dueDate: "", status: "Not Started" }],
};

describe("project actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOpsUser.mockResolvedValue({ id: "admin" });
    mocks.createServer.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { status: "ok", project_id: projectId }, error: null });
  });

  it("authenticates before rejecting invalid create input", async () => {
    await expect(createProject({})).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.requireOpsUser).toHaveBeenCalledOnce();
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("creates a normalized project plan", async () => {
    await expect(createProject(input)).resolves.toEqual({ status: "success", projectId });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_project_with_plan",
      expect.objectContaining({
        p_project: expect.objectContaining({ client_id: clientId, project_type: "Film" }),
        p_tasks: [expect.objectContaining({ title: "Confirm brief", is_completed: false })],
      }),
    );
  });

  it("converts an enquiry and refreshes linked records", async () => {
    await convertEnquiryToProject(enquiryId, input);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "convert_enquiry_to_project",
      expect.objectContaining({ p_enquiry_id: enquiryId }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
  });

  it("updates the requested project", async () => {
    await updateProject(projectId, input);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_project_with_plan",
      expect.objectContaining({ p_project_id: projectId }),
    );
  });

  it("moves through the narrow movement RPC", async () => {
    await moveProject(projectId, "Production", 2);
    expect(mocks.rpc).toHaveBeenCalledWith("move_project", {
      p_project_id: projectId,
      p_status: "Production",
      p_stage_position: 2,
    });
  });

  it("rejects malformed movement before database access", async () => {
    await expect(moveProject(projectId, "Draft", -1)).resolves.toMatchObject({
      status: "invalid",
    });
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("calls each quick-action RPC with its narrow payload", async () => {
    await setProjectMilestoneCompleted(itemId, true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_project_milestone_completed", {
      p_milestone_id: itemId,
      p_completed: true,
    });
    await setProjectTaskCompleted(itemId, false);
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_project_task_completed", {
      p_task_id: itemId,
      p_completed: false,
    });
    await setProjectDeliverableStatus(itemId, "Ready");
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_project_deliverable_status", {
      p_deliverable_id: itemId,
      p_status: "Ready",
    });
  });

  it("archives and restores through the dedicated RPC", async () => {
    await setProjectArchived(projectId, true);
    expect(mocks.rpc).toHaveBeenCalledWith("set_project_archived", {
      p_project_id: projectId,
      p_archived: true,
    });
  });

  it("returns a conflict link and calm database errors", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: "conflict", project_id: projectId },
      error: null,
    });
    await expect(convertEnquiryToProject(enquiryId, input)).resolves.toEqual({
      status: "conflict",
      projectId,
      message: "This enquiry already has a project.",
    });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(createProject(input)).resolves.toMatchObject({ status: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
