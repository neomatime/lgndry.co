import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { artworkFromRow, type Artwork } from "@/features/shop/catalogue/artwork";
import { getPublicEnv } from "@/lib/env";

/**
 * The published collection, in display order, or `null` when it can't be
 * loaded (so pages can show a "temporarily unavailable" state instead of an
 * error). Read as the anonymous role with no cookies, which keeps the pages
 * that call it statically renderable; row-level security already limits what
 * that role sees to works that aren't archived or hidden.
 */
export const fetchCollection = cache(async (): Promise<Artwork[] | null> => {
  try {
    const env = getPublicEnv();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.from("collection").select("*").order("position");
    if (error) throw error;
    return data
      .filter((row) => !row.archived && row.availability !== "Hidden")
      .map((row) => artworkFromRow(row as Record<string, unknown>));
  } catch (error) {
    console.error("Could not load the collection", error);
    return null;
  }
});
