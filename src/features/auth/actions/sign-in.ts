"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { safeNextPath, signInSchema } from "@/features/auth/schemas/sign-in";

export type SignInState = { error?: string };

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter a valid email address and your password." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // One generic message for every failure: don't reveal which accounts exist.
  if (error) return { error: "That email and password combination didn't work." };

  // redirect() works by throwing, so it must stay outside any try/catch.
  redirect(safeNextPath(parsed.data.next));
}
