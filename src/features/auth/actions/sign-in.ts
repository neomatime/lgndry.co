"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/db/server";
import { safeNextPath, signInSchema } from "@/features/auth/schemas/sign-in";

export type SignInState = {
  error?: string;
  email?: string;
  fieldErrors?: { email?: string; password?: string };
};

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    keepSignedIn: formData.get("keepSignedIn") === "on",
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      error: "Check the highlighted details and try again.",
      email: String(formData.get("email") ?? ""),
      fieldErrors: {
        email: fields.email?.[0],
        password: fields.password?.[0] ? "Enter your password." : undefined,
      },
    };
  }

  const supabase = await createSupabaseServerClient({ sessionOnly: !parsed.data.keepSignedIn });
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // One generic message for every failure: don't reveal which accounts exist.
  if (error) {
    return {
      error: "That email and password combination didn't work.",
      email: parsed.data.email,
    };
  }

  const cookieStore = await cookies();
  if (parsed.data.keepSignedIn) {
    cookieStore.delete("lgndry.ops.session-only");
  } else {
    cookieStore.set("lgndry.ops.session-only", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  // redirect() works by throwing, so it must stay outside any try/catch.
  redirect(safeNextPath(parsed.data.next));
}
