import { describe, expect, it } from "vitest";
import {
  settingsInput,
  settingsRpcPayload,
  shapeOpsSettings,
} from "@/features/settings/settings-view-model";
import { OPS_SETTINGS_ID } from "@/features/settings/types";

const record = {
  id: OPS_SETTINGS_ID,
  workspace_name: "LGNDRY.Co",
  company_email: "info@lgndry-co.co.za",
  company_phone: null,
  website_url: "https://www.lgndry-co.co.za",
  business_address: null,
  registration_number: null,
  time_zone: "Africa/Johannesburg",
  currency: "ZAR",
  default_quote_terms: null,
  default_retainer_percentage: "50.00",
  default_quote_validity_days: 7,
  default_deposit_due_days: 3,
  bank_name: null,
  account_holder: null,
  account_number: null,
  branch_code: null,
  account_type: null,
  payment_reference_instructions: null,
  sender_name: "LGNDRY.Co",
  sender_email: "info@lgndry-co.co.za",
  reply_to_email: "info@lgndry-co.co.za",
  version: 1,
  updated_at: "2026-10-20T08:00:00Z",
};

describe("settings view model", () => {
  it("shapes database fields and normalizes nullable text", () => {
    expect(shapeOpsSettings(record)).toMatchObject({
      id: OPS_SETTINGS_ID,
      workspaceName: "LGNDRY.Co",
      companyPhone: "",
      defaultQuoteTerms: "",
      defaultRetainerPercentage: 50,
      timeZone: "Africa/Johannesburg",
      currency: "ZAR",
      version: 1,
    });
  });

  it("rejects the wrong singleton or locale", () => {
    expect(() => shapeOpsSettings({ ...record, id: crypto.randomUUID() })).toThrow();
    expect(() => shapeOpsSettings({ ...record, currency: "USD" })).toThrow();
  });

  it("extracts editable input and creates the exact RPC payload", () => {
    const shaped = shapeOpsSettings(record);
    const input = settingsInput(shaped);
    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("version");
    expect(settingsRpcPayload(input)).toMatchObject({
      workspace_name: "LGNDRY.Co",
      company_email: "info@lgndry-co.co.za",
      time_zone: "Africa/Johannesburg",
      currency: "ZAR",
      default_retainer_percentage: 50,
    });
  });
});
