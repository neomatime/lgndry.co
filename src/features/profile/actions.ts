"use server";

import { revalidatePath } from "next/cache";
import { passwordInputSchema, profileInputSchema } from "@/features/profile/schemas";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

type ActionResult =
  | { status: "success"; message: string }
  | { status: "invalid"; message: string; fieldErrors: Record<string, string[]> }
  | { status: "error"; message: string };

function validationErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

export async function updateOpsProfile(input: unknown): Promise<ActionResult> {
  await requireOpsUser();
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check your name and try again.",
      fieldErrors: validationErrors(parsed.error.issues),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: parsed.data.fullName },
    });
    if (error) throw error;
    revalidatePath("/ops", "layout");
    return { status: "success", message: "Profile updated." };
  } catch (error) {
    console.error("Could not update OPS profile", error);
    return { status: "error", message: "We couldn't update your profile just now." };
  }
}

export async function updateOpsPassword(input: unknown): Promise<ActionResult> {
  await requireOpsUser();
  const parsed = passwordInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check the new password and try again.",
      fieldErrors: validationErrors(parsed.error.issues),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw error;
    return { status: "success", message: "Password updated." };
  } catch (error) {
    console.error("Could not update OPS password", error);
    return { status: "error", message: "We couldn't update your password just now." };
  }
}
