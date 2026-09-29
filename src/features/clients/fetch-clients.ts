import "server-only";
import {
  buildClientListItems,
  type ClientListItem,
  type ClientListRecord,
} from "@/features/clients/list-view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

export async function fetchClients(): Promise<ClientListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [clientsResult, activityResult] = await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, name, type, status, account_tier, industry, region, client_since, account_overview, preferred_services, relationship_notes, archived, created_at, updated_at, client_contacts(id, full_name, role_title, email, phone, is_primary), enquiries(id, status, created_at)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("ops_activity_log")
        .select("record_id, created_at")
        .eq("collection", "clients")
        .order("created_at", { ascending: false }),
    ]);

    if (clientsResult.error) throw clientsResult.error;
    if (activityResult.error) throw activityResult.error;

    const activityByClient = new Map<string, string>();
    for (const activity of (activityResult.data ?? []) as {
      record_id: string | null;
      created_at: string;
    }[]) {
      if (activity.record_id && !activityByClient.has(activity.record_id)) {
        activityByClient.set(activity.record_id, activity.created_at);
      }
    }

    return buildClientListItems((clientsResult.data ?? []) as ClientListRecord[], activityByClient);
  } catch (error) {
    console.error("Could not load clients", error);
    return null;
  }
}
