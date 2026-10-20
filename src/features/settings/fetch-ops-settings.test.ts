import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPS_SETTINGS_ID } from "@/features/settings/types";

const result = { data: [] as unknown[], error: null as { message: string } | null };
const limit = vi.fn(() => Promise.resolve(result));
const select = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from }),
}));

const row = {
  id: OPS_SETTINGS_ID,
  workspace_name: "LGNDRY.Co",
  company_email: "info@lgndry-co.co.za",
  company_phone: "",
  website_url: "https://www.lgndry-co.co.za",
  business_address: "",
  registration_number: "",
  time_zone: "Africa/Johannesburg",
  currency: "ZAR",
  default_quote_terms: "",
  default_retainer_percentage: 50,
  default_quote_validity_days: 7,
  default_deposit_due_days: 3,
  bank_name: "",
  account_holder: "",
  account_number: "",
  branch_code: "",
  account_type: "",
  payment_reference_instructions: "",
  sender_name: "LGNDRY.Co",
  sender_email: "info@lgndry-co.co.za",
  reply_to_email: "info@lgndry-co.co.za",
  version: 1,
  updated_at: "2026-10-20T08:00:00Z",
};

describe("fetchOpsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    result.data = [row];
    result.error = null;
  });

  it("loads and strictly shapes the singleton row", async () => {
    const { fetchOpsSettings } = await import("@/features/settings/fetch-ops-settings");
    await expect(fetchOpsSettings()).resolves.toMatchObject({
      status: "ok",
      settings: { workspaceName: "LGNDRY.Co", version: 1 },
    });
    expect(from).toHaveBeenCalledWith("ops_settings");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("default_quote_terms"));
    expect(limit).toHaveBeenCalledWith(2);
  });

  it.each([
    { label: "no rows", rows: [] },
    { label: "duplicate rows", rows: [row, row] },
  ])("returns error when $label are visible", async ({ rows }) => {
    result.data = rows;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchOpsSettings } = await import("@/features/settings/fetch-ops-settings");
    await expect(fetchOpsSettings()).resolves.toEqual({ status: "error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns error for database and record-shape failures", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    result.error = { message: "connection refused" };
    const { fetchOpsSettings } = await import("@/features/settings/fetch-ops-settings");
    await expect(fetchOpsSettings()).resolves.toEqual({ status: "error" });
    result.error = null;
    result.data = [{ ...row, currency: "USD" }];
    await expect(fetchOpsSettings()).resolves.toEqual({ status: "error" });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
