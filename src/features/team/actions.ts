"use server";

import { revalidatePath } from "next/cache";
import { inviteTeamMemberSchema, removeTeamMemberSchema } from "@/features/team/schemas";
import type { TeamActionResult } from "@/features/team/types";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

function validationErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

async function invokeTeam(body: Record<string, string>) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.functions.invoke("manage-team", { body });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }
}

export async function inviteTeamMember(input: unknown): Promise<TeamActionResult> {
  await requireOpsUser();
  const parsed = inviteTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check the account details and try again.",
      fieldErrors: validationErrors(parsed.error.issues),
    };
  }
  try {
    await invokeTeam({ action: "invite", ...parsed.data });
    revalidatePath("/ops/settings/team");
    return { status: "success", message: "Team member added." };
  } catch (error) {
    console.error("Could not add OPS team member", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "We couldn't add that team member.",
    };
  }
}

export async function removeTeamMember(input: unknown): Promise<TeamActionResult> {
  await requireOpsUser();
  const parsed = removeTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Select a valid team member.",
      fieldErrors: validationErrors(parsed.error.issues),
    };
  }
  try {
    await invokeTeam({ action: "remove", userId: parsed.data.userId });
    revalidatePath("/ops/settings/team");
    return { status: "success", message: "Team member access removed." };
  } catch (error) {
    console.error("Could not remove OPS team member", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "We couldn't remove that team member.",
    };
  }
}
