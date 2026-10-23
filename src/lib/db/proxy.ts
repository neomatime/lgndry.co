import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookies for a request and reports whether
 * a verified session exists. Used only from src/proxy.ts; authorization
 * (admin membership) is enforced again server-side in lib/auth/guards.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const sessionOnly = request.cookies.get("lgndry.ops.session-only")?.value === "1";

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            if (sessionOnly) {
              const sessionOptions = { ...options };
              delete sessionOptions.expires;
              delete sessionOptions.maxAge;
              response.cookies.set(name, value, sessionOptions);
            } else {
              response.cookies.set(name, value, options);
            }
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  return { response, isAuthenticated: Boolean(data?.claims) };
}
