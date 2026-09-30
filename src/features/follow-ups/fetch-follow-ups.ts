import "server-only";

import { shapeFollowUp, type FollowUpRecord } from "@/features/follow-ups/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";
import { createSupabaseServerClient } from "@/lib/db/server";

export const FOLLOW_UP_SELECT = `
  id, reference_number, client_id, contact_id, enquiry_id, project_id,
  follow_up_type, custom_type, title, overview, notes, due_date, due_time,
  priority, contact_methods, status, outcome, cancellation_reason, completed_at,
  cancelled_at, owner_user_id, owner_name, owner_email, series_id,
  occurrence_number, successor_id, version, created_at, updated_at,
  client_record:clients!follow_ups_client_id_fkey(id, name),
  contact_record:client_contacts!follow_ups_contact_id_fkey(
    id, full_name, email, phone, role_title
  ),
  enquiry_record:enquiries!follow_ups_enquiry_id_fkey(id, project_type),
  project_record:projects!follow_ups_project_id_fkey(id, name),
  follow_up_checklist_items(
    id, label, sort_order, is_completed, completed_at, version
  )
`;

export async function fetchFollowUps(): Promise<FollowUpListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("follow_ups")
      .select(FOLLOW_UP_SELECT)
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return ((data ?? []) as unknown as FollowUpRecord[]).map((record) => shapeFollowUp(record));
  } catch (error) {
    console.error("Could not load follow-ups", error);
    return null;
  }
}
