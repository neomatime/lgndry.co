import "server-only";
import { cache } from "react";
import { fetchRelatedFollowUps } from "@/features/follow-ups/fetch-related-follow-ups";
import {
  buildParentFollowUps,
  type ParentFollowUps,
} from "@/features/follow-ups/related-view-model";
import { fetchProjectDetail } from "@/features/projects/fetch-project-detail";
import type { ProjectDetail } from "@/features/projects/types";
import { createSupabaseServerClient } from "@/lib/db/server";

export type ProjectDetailPageResult =
  | { status: "ok"; project: ProjectDetail; followUps: ParentFollowUps }
  | { status: "not-found" }
  | { status: "error" };

/**
 * The project DETAIL page's loader: the plain project detail plus its follow-ups and whether
 * its client is archived (the follow-up form can't pre-fill an archived client). Kept apart
 * from `fetchProjectDetail` so the edit page neither pays for these queries nor fails when
 * they are unavailable. Nothing extra is requested unless the project exists, and an
 * unavailable query fails the page rather than reading as "no follow-ups".
 */
export const fetchProjectDetailPage = cache(
  async (id: string): Promise<ProjectDetailPageResult> => {
    const result = await fetchProjectDetail(id);
    if (result.status !== "ok") return result;

    try {
      const { project } = result;
      const supabase = await createSupabaseServerClient();
      const [rows, clientResult] = await Promise.all([
        fetchRelatedFollowUps("project_id", id),
        supabase.from("clients").select("archived").eq("id", project.clientId).maybeSingle(),
      ]);
      if (!rows) return { status: "error" };
      if (clientResult.error) throw clientResult.error;
      return {
        status: "ok",
        project,
        followUps: buildParentFollowUps(rows, new Date(), {
          archived: project.archived,
          clientId: project.clientId,
          clientArchived: (clientResult.data as { archived?: boolean } | null)?.archived === true,
        }),
      };
    } catch (error) {
      console.error("Could not load project follow-up context", id, error);
      return { status: "error" };
    }
  },
);
