import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createServer: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateOpsSettings } from "@/features/settings/actions";

const input = {
  workspaceName: "LGNDRY.Co",
  companyEmail: "info@lgndry-co.co.za",
  companyPhone: "0764862725",
  websiteUrl: "https://www.lgndry-co.co.za",
  businessAddress: "Polokwane",
  registrationNumber: "",
  defaultQuoteTerms: "Terms",
  defaultRetainerPercentage: 50,
  defaultQuoteValidityDays: 7,
  defaultDepositDueDays: 3,
  bankName: "Bank",
  accountHolder: "LGNDRY.Co",
  accountNumber: "123",
  branchCode: "456",
  accountType: "Cheque",
  paymentReferenceInstructions: "Use the invoice number",
  senderName: "LGNDRY.Co",
  senderEmail: "info@lgndry-co.co.za",
  replyToEmail: "info@lgndry-co.co.za",
};

describe("updateOpsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ id: "admin" });
    mocks.createServer.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { status: "ok", version: 2 }, error: null });
  });

  it("authenticates before rejecting invalid input", async () => {
    await expect(updateOpsSettings({}, 1)).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("rejects an invalid expected version without database access", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(updateOpsSettings(input, null)).resolves.toMatchObject({ status: "error" });
    expect(mocks.createServer).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("sends the exact versioned payload and revalidates on success", async () => {
    await expect(updateOpsSettings(input, 1)).resolves.toEqual({ status: "success", version: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("update_ops_settings", {
      p_settings: expect.objectContaining({
        workspace_name: "LGNDRY.Co",
        time_zone: "Africa/Johannesburg",
        currency: "ZAR",
        default_retainer_percentage: 50,
      }),
      p_expected_version: 1,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ops/settings");
  });

  it("returns a conflict without revalidation", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "conflict", version: 4 }, error: null });
    await expect(updateOpsSettings(input, 1)).resolves.toEqual({
      status: "conflict",
      currentVersion: 4,
      message: "These settings changed elsewhere. Load the current settings before saving.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    { label: "database error", response: { data: null, error: { message: "nope" } } },
    {
      label: "malformed response",
      response: { data: { status: "mystery" }, error: null },
    },
  ])("returns a calm error for $label", async ({ response }) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue(response);
    await expect(updateOpsSettings(input, 1)).resolves.toMatchObject({ status: "error" });
    expect(spy).toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("catches an unexpected server failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createServer.mockRejectedValue(new Error("offline"));
    await expect(updateOpsSettings(input, 1)).resolves.toMatchObject({ status: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
