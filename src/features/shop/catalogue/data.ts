import "server-only";
import { cache } from "react";
import { artworkFromRow, type Artwork } from "@/features/shop/catalogue/artwork";
import { createSupabaseAnonClient } from "@/lib/db/anon";

/**
 * The published collection, in display order, or `null` when it can't be
 * loaded (so pages can show a "temporarily unavailable" state instead of an
 * error). Read as the anonymous role with no cookies, which keeps the pages
 * that call it statically renderable; row-level security already limits what
 * that role sees to works that aren't archived or hidden.
 */
export const fetchCollection = cache(async (): Promise<Artwork[] | null> => {
  try {
    const client = createSupabaseAnonClient();
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
