import "server-only";
import {
  buildClientListItems,
  type ClientListActivityRecord,
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
          "id, name, type, status, account_tier, industry, region, client_since, account_overview, preferred_services, relationship_notes, archived, created_at, updated_at, client_contacts(id, full_name, role_title, email, phone, is_primary), enquiries(id, project_type, status, created_at)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("ops_activity_log")
        .select("id, record_id, message, created_at")
        .eq("collection", "clients")
        .order("created_at", { ascending: false }),
    ]);

    if (clientsResult.error) throw clientsResult.error;
    if (activityResult.error) throw activityResult.error;

    const activityByClient = new Map<string, ClientListActivityRecord[]>();
    for (const activity of (activityResult.data ?? []) as (ClientListActivityRecord & {
      record_id: string | null;
    })[]) {
      if (!activity.record_id) continue;
      const entries = activityByClient.get(activity.record_id) ?? [];
      entries.push({
        id: activity.id,
        message: activity.message,
        created_at: activity.created_at,
      });
      activityByClient.set(activity.record_id, entries);
    }

    return buildClientListItems((clientsResult.data ?? []) as ClientListRecord[], activityByClient);
  } catch (error) {
    console.error("Could not load clients", error);
    return null;
  }
}
