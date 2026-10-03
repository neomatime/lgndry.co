import "server-only";

import { cache } from "react";
import {
  buildProjectDetail,
  type ProjectBookingRecord,
  type ProjectDetailRecord,
  type ProjectEnquiryRecord,
  type ProjectMilestoneRecord,
} from "@/features/projects/detail-view-model";
import type {
  ProjectActivityRecord,
  ProjectDeliverableRecord,
  ProjectTaskRecord,
} from "@/features/projects/list-view-model";
import type { ProjectDetail } from "@/features/projects/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROJECT_DETAIL_SELECT = `
  id, name, client, client_contact_id, project_type, services, brief, location,
  start_date, end_date, timeline, people_resources, budget_min, budget_max,
  currency, status, stage_position, payment_status, delivery_status, archived,
  created_at, updated_at, enquiry_id, booking,
  client_record:clients!projects_client_fkey(id, name),
  contact_record:client_contacts!projects_client_contact_id_fkey(
    id, full_name, email, phone, is_primary
  )
`;

export type FetchProjectDetailResult =
  { status: "ok"; project: ProjectDetail } | { status: "not-found" } | { status: "error" };

export const fetchProjectDetail = cache(async (id: string): Promise<FetchProjectDetailResult> => {
  if (!UUID_RE.test(id)) return { status: "not-found" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(PROJECT_DETAIL_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return { status: "not-found" };

    const [milestones, tasks, deliverables, activity, enquiry, booking] = await Promise.all([
      supabase
        .from("project_milestones")
        .select("id, title, description, due_date, status, sort_order, completed_at")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("project_tasks")
        .select("id, title, due_date, is_completed, sort_order, completed_at")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("project_deliverables")
        .select("id, title, due_date, status, sort_order, completed_at")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ops_activity_log")
        .select("id, message, action, created_at")
        .eq("collection", "projects")
        .eq("record_id", id)
        .order("created_at", { ascending: false }),
      project.enquiry_id
        ? supabase
            .from("enquiries")
            .select("id, status, project_type")
            .eq("id", project.enquiry_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      project.booking
        ? supabase
            .from("bookings")
            .select("id, date, location, status, deposit")
            .eq("id", project.booking)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    for (const result of [milestones, tasks, deliverables, activity, enquiry, booking]) {
      if (result.error) throw result.error;
    }

    return {
      status: "ok",
      project: buildProjectDetail(
        project as unknown as ProjectDetailRecord,
        (milestones.data ?? []) as ProjectMilestoneRecord[],
        (tasks.data ?? []) as ProjectTaskRecord[],
        (deliverables.data ?? []) as ProjectDeliverableRecord[],
        (enquiry.data ?? null) as ProjectEnquiryRecord | null,
        (booking.data ?? null) as ProjectBookingRecord | null,
        (activity.data ?? []) as ProjectActivityRecord[],
      ),
    };
  } catch (error) {
    console.error("Could not load project", id, error);
    return { status: "error" };
  }
});
