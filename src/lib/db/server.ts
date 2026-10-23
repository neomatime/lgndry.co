import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/** Supabase client bound to the current request's auth cookies (RLS applies). */
export async function createSupabaseServerClient(options?: { sessionOnly?: boolean }) {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  const sessionOnly =
    options?.sessionOnly ?? cookieStore.get("lgndry.ops.session-only")?.value === "1";

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            if (sessionOnly) {
              const sessionOptions = { ...cookieOptions };
              delete sessionOptions.expires;
              delete sessionOptions.maxAge;
              cookieStore.set(name, value, sessionOptions);
            } else {
              cookieStore.set(name, value, cookieOptions);
            }
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session on every /ops request instead.
        }
      },
    },
  });
}
