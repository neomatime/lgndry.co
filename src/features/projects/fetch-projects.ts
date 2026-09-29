import "server-only";

import {
  shapeProjectRows,
  type ProjectActivityRecord,
  type ProjectListRecord,
} from "@/features/projects/list-view-model";
import type { ProjectListItem } from "@/features/projects/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const PROJECT_LIST_SELECT = `
  id, name, client, client_contact_id, project_type, services, brief, location,
  start_date, end_date, status, stage_position, payment_status, delivery_status,
  archived, created_at, updated_at, enquiry_id, booking,
  client_record:clients!projects_client_fkey(id, name),
  contact_record:client_contacts!projects_client_contact_id_fkey(
    id, full_name, email, phone, is_primary
  ),
  project_tasks(id, title, due_date, is_completed, sort_order, completed_at),
  project_deliverables(id, title, due_date, status, sort_order, completed_at)
`;

export async function fetchProjects(): Promise<ProjectListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [projectsResult, activityResult] = await Promise.all([
      supabase
        .from("projects")
        .select(PROJECT_LIST_SELECT)
        .order("stage_position", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("ops_activity_log")
        .select("id, record_id, message, action, created_at")
        .eq("collection", "projects")
        .order("created_at", { ascending: false }),
    ]);

    if (projectsResult.error) throw projectsResult.error;
    if (activityResult.error) throw activityResult.error;

    const activityByProject = new Map<string, ProjectActivityRecord[]>();
    for (const activity of (activityResult.data ?? []) as (ProjectActivityRecord & {
      record_id: string | null;
    })[]) {
      if (!activity.record_id) continue;
      const entries = activityByProject.get(activity.record_id) ?? [];
      entries.push(activity);
      activityByProject.set(activity.record_id, entries);
    }

    return shapeProjectRows(
      (projectsResult.data ?? []) as unknown as ProjectListRecord[],
      activityByProject,
    );
  } catch (error) {
    console.error("Could not load projects", error);
    return null;
  }
}
