import "server-only";

import { fetchClients } from "@/features/clients/fetch-clients";
import type { DashboardActivityRecord, DashboardSourceData } from "@/features/dashboard/types";
import { fetchEnquiries } from "@/features/enquiries/fetch-enquiries";
import { fetchFollowUps } from "@/features/follow-ups/fetch-follow-ups";
import { withScheduleStates } from "@/features/follow-ups/list-view-model";
import { fetchInvoices } from "@/features/invoices/fetch-invoices";
import { fetchQuotes } from "@/features/invoices/fetch-quotes";
import { fetchProjects } from "@/features/projects/fetch-projects";
import { createSupabaseServerClient } from "@/lib/db/server";

type ActivityRow = {
  id: string;
  collection: string | null;
  record_id: string | null;
  message: string;
  action: string | null;
  created_at: string;
};

export async function fetchDashboardData(
  today: string,
  now: Date,
): Promise<DashboardSourceData | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [
      enquiries,
      projects,
      clients,
      followUps,
      invoices,
      quotes,
      activityResult,
      threadResult,
    ] = await Promise.all([
      fetchEnquiries(),
      fetchProjects(),
      fetchClients(),
      fetchFollowUps(),
      fetchInvoices(today),
      fetchQuotes(),
      supabase
        .from("ops_activity_log")
        .select("id, collection, record_id, message, action, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("email_threads").select("id", { count: "exact", head: true }),
    ]);

    if (!enquiries || !projects || !clients || !followUps || !invoices || !quotes) return null;
    if (activityResult.error) throw activityResult.error;
    if (threadResult.error) throw threadResult.error;

    const activity = ((activityResult.data ?? []) as ActivityRow[]).map(
      (row): DashboardActivityRecord => ({
        id: row.id,
        collection: row.collection,
        recordId: row.record_id,
        message: row.message,
        action: row.action,
        createdAt: row.created_at,
      }),
    );

    return {
      enquiries,
      projects,
      clients,
      followUps: withScheduleStates(followUps, now),
      invoices,
      quotes,
      communicationCount: threadResult.count ?? 0,
      activity,
    };
  } catch (error) {
    console.error("Could not load Command Center dashboard", error);
    return null;
  }
}
