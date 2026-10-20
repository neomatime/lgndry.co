"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { opsSettingsInputSchema } from "@/features/settings/schemas";
import { settingsRpcPayload } from "@/features/settings/settings-view-model";
import type { OpsSettingsActionResult } from "@/features/settings/types";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

const rpcResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), version: z.number().int().positive() }),
  z.object({ status: z.literal("conflict"), version: z.number().int().positive() }),
]);

const VERSION = z.number().int().positive();
const FAILED = "We couldn't save the settings just now. Please try again.";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export async function updateOpsSettings(
  input: unknown,
  expectedVersion: unknown,
): Promise<OpsSettingsActionResult> {
  await requireOpsUser();

  const parsed = opsSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check the highlighted settings and try again.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  if (!VERSION.safeParse(expectedVersion).success) {
    console.error("settings: update received an invalid version");
    return { status: "error", message: FAILED };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_ops_settings", {
      p_settings: settingsRpcPayload(parsed.data),
      p_expected_version: expectedVersion as number,
    });
    if (error) {
      console.error("settings: update failed", error.message ?? "database error");
      return { status: "error", message: FAILED };
    }
    const rpc = rpcResultSchema.safeParse(data);
    if (!rpc.success) {
      console.error("settings: update returned an invalid response");
      return { status: "error", message: FAILED };
    }
    if (rpc.data.status === "conflict") {
      return {
        status: "conflict",
        currentVersion: rpc.data.version,
        message: "These settings changed elsewhere. Load the current settings before saving.",
      };
    }
    revalidatePath("/ops/settings");
    return { status: "success", version: rpc.data.version };
  } catch (error) {
    console.error("settings: update failed", error);
    return { status: "error", message: FAILED };
  }
}
