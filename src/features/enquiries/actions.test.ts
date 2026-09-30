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

import { setEnquiryStatus, updateEnquiry } from "@/features/enquiries/actions";

const enquiryId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const input = {
  fullName: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  projectType: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
};

describe("enquiry actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOpsUser.mockResolvedValue({ id: "admin" });
    mocks.createServer.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { status: "ok", enquiry_id: enquiryId }, error: null });
  });

  it("authenticates before rejecting invalid input", async () => {
    await expect(updateEnquiry(enquiryId, {})).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.requireOpsUser).toHaveBeenCalledOnce();
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("updates the normalized enquiry and refreshes its views", async () => {
    await expect(updateEnquiry(enquiryId, input)).resolves.toEqual({
      status: "success",
      enquiryId,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("update_enquiry_record", {
      p_enquiry_id: enquiryId,
      p_enquiry: expect.objectContaining({
        full_name: "Thandi Mokoena",
        project_type: "Documentary",
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}/edit`);
  });

  it("changes a manually managed status", async () => {
    await expect(setEnquiryStatus(enquiryId, "Reviewing")).resolves.toEqual({
      status: "success",
      enquiryId,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("set_enquiry_status", {
      p_enquiry_id: enquiryId,
      p_status: "Reviewing",
    });
  });

  it("rejects project-managed statuses before database access", async () => {
    await expect(setEnquiryStatus(enquiryId, "Booked")).resolves.toMatchObject({
      status: "invalid",
    });
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("returns the linked project when status ownership conflicts", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: "conflict", project_id: projectId },
      error: null,
    });
    await expect(setEnquiryStatus(enquiryId, "Closed")).resolves.toEqual({
      status: "conflict",
      projectId,
      message: "This enquiry's status is managed by its linked project.",
    });
  });

  it("returns a calm error for database failures", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    await expect(updateEnquiry(enquiryId, input)).resolves.toMatchObject({ status: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
