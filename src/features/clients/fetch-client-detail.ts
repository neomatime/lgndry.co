import "server-only";
import { cache } from "react";
import { buildClientDetail, type ClientDetail } from "@/features/clients/detail-view-model";
import { fetchRelatedFollowUps } from "@/features/follow-ups/fetch-related-follow-ups";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClientDetailResult =
  { status: "ok"; client: ClientDetail } | { status: "not-found" } | { status: "error" };

export const fetchClientDetail = cache(async (id: string): Promise<ClientDetailResult> => {
  if (!UUID_RE.test(id)) return { status: "not-found" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select(
        "id, name, type, status, account_tier, industry, region, client_since, account_overview, preferred_services, relationship_notes, archived",
      )
      .eq("id", id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return { status: "not-found" };

    const [contactsResult, enquiriesResult, projectsResult, activityResult, followUps] =
      await Promise.all([
        supabase
          .from("client_contacts")
          .select("id, full_name, role_title, email, phone, is_primary")
          .eq("client_id", id)
          .order("is_primary", { ascending: false }),
        supabase
          .from("enquiries")
          .select("id, project_type, status, created_at")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name, status, start_date, end_date, delivery_status, archived")
          .eq("client", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("ops_activity_log")
          .select("id, message, created_at")
          .eq("collection", "clients")
          .eq("record_id", id)
          .order("created_at", { ascending: false }),
        fetchRelatedFollowUps("client_id", id),
      ]);

    if (contactsResult.error) throw contactsResult.error;
    if (enquiriesResult.error) throw enquiriesResult.error;
    if (projectsResult.error) throw projectsResult.error;
    if (activityResult.error) throw activityResult.error;
    // An unavailable follow-ups query must not read as "no follow-ups": that would hide real
    // work, so it fails the page like any other required child query.
    if (!followUps) throw new Error("Follow-ups are unavailable");

    return {
      status: "ok",
      client: buildClientDetail(
        client,
        contactsResult.data ?? [],
        enquiriesResult.data ?? [],
        projectsResult.data ?? [],
        activityResult.data ?? [],
        new Date(),
        followUps,
      ),
    };
  } catch (error) {
    console.error("Could not load client", id, error);
    return { status: "error" };
  }
});
