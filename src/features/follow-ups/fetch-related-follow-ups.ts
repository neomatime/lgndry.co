import "server-only";

import { FOLLOW_UP_SELECT } from "@/features/follow-ups/fetch-follow-ups";
import { shapeFollowUp, type FollowUpRecord } from "@/features/follow-ups/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";
import { createSupabaseServerClient } from "@/lib/db/server";

export async function fetchRelatedFollowUps(
  relation: "client_id" | "enquiry_id" | "project_id",
  id: string,
): Promise<FollowUpListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("follow_ups")
      .select(FOLLOW_UP_SELECT)
      .eq(relation, id)
      .order("due_date", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as FollowUpRecord[]).map((record) => shapeFollowUp(record));
  } catch (error) {
    console.error("Could not load related follow-ups", relation, id, error);
    return null;
  }
}
