import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/**
 * A Supabase client that acts as an anonymous visitor: no cookies, no stored
 * session. For reads that must not depend on who is browsing (which also keeps
 * the pages that make them statically renderable), and for writes that are
 * deliberately made as a guest. Row-level security applies as for any visitor.
 */
export function createSupabaseAnonClient() {
  const env = getPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
