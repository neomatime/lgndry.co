import "server-only";

import { cache } from "react";
import {
  buildFollowUpDetail,
  type FollowUpSeriesRecord,
} from "@/features/follow-ups/detail-view-model";
import { FOLLOW_UP_SELECT } from "@/features/follow-ups/fetch-follow-ups";
import type { FollowUpActivityRecord, FollowUpRecord } from "@/features/follow-ups/list-view-model";
import type { FollowUpDetail } from "@/features/follow-ups/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FetchFollowUpDetailResult =
  { status: "ok"; followUp: FollowUpDetail } | { status: "not-found" } | { status: "error" };

export const fetchFollowUpDetail = cache(async (id: string): Promise<FetchFollowUpDetailResult> => {
  if (!UUID_RE.test(id)) return { status: "not-found" };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: followUp, error } = await supabase
      .from("follow_ups")
      .select(FOLLOW_UP_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!followUp) return { status: "not-found" };
    const record = followUp as unknown as FollowUpRecord;
    const [series, predecessor, activity] = await Promise.all([
      record.series_id
        ? supabase
            .from("follow_up_series")
            .select(
              "id, frequency, interval_count, weekdays, month_anchor, recurrence_rule, ends_on, max_occurrences, occurrences_created, active, version",
            )
            .eq("id", record.series_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      record.series_id && record.occurrence_number > 1
        ? supabase
            .from("follow_ups")
            .select("id")
            .eq("series_id", record.series_id)
            .eq("occurrence_number", record.occurrence_number - 1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("ops_activity_log")
        .select("id, message, action, created_at")
        .eq("collection", "follow_ups")
        .eq("record_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (series.error) throw series.error;
    if (predecessor.error) throw predecessor.error;
    if (activity.error) throw activity.error;
    return {
      status: "ok",
      followUp: buildFollowUpDetail(
        record,
        (series.data ?? null) as FollowUpSeriesRecord | null,
        predecessor.data?.id ?? null,
        (activity.data ?? []) as FollowUpActivityRecord[],
      ),
    };
  } catch (error) {
    console.error("Could not load follow-up", id, error);
    return { status: "error" };
  }
});
