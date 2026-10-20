import "server-only";
import { shapeOpsSettings } from "@/features/settings/settings-view-model";
import type { OpsSettings } from "@/features/settings/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const SETTINGS_SELECT = `
  id, workspace_name, company_email, company_phone, website_url,
  business_address, registration_number, time_zone, currency,
  default_quote_terms, default_retainer_percentage,
  default_quote_validity_days, default_deposit_due_days,
  bank_name, account_holder, account_number, branch_code, account_type,
  payment_reference_instructions, sender_name, sender_email, reply_to_email,
  version, updated_at
`;

export type OpsSettingsFetchResult = { status: "ok"; settings: OpsSettings } | { status: "error" };

export async function fetchOpsSettings(): Promise<OpsSettingsFetchResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("ops_settings").select(SETTINGS_SELECT).limit(2);
    if (error) throw error;
    if (!data || data.length !== 1) {
      throw new Error(`Expected one OPS settings row, received ${data?.length ?? 0}`);
    }
    return { status: "ok", settings: shapeOpsSettings(data[0]) };
  } catch (error) {
    console.error("Could not load OPS settings", error);
    return { status: "error" };
  }
}
