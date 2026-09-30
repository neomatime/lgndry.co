import type { FollowUpDetail, FollowUpInput, FollowUpSeries } from "@/features/follow-ups/types";
import {
  shapeFollowUp,
  shapeFollowUpActivity,
  type FollowUpActivityRecord,
  type FollowUpRecord,
} from "@/features/follow-ups/list-view-model";

export type FollowUpSeriesRecord = {
  id: string;
  frequency: FollowUpSeries["frequency"];
  interval_count: number;
  weekdays: number[];
  month_anchor: number | null;
  recurrence_rule: string;
  ends_on: string | null;
  max_occurrences: number | null;
  occurrences_created: number;
  active: boolean;
  version: number;
};

export function buildFollowUpDetail(
  record: FollowUpRecord,
  series: FollowUpSeriesRecord | null,
  predecessorId: string | null,
  activity: FollowUpActivityRecord[],
  now = new Date(),
): FollowUpDetail {
  return {
    ...shapeFollowUp(record, now),
    series: series
      ? {
          id: series.id,
          frequency: series.frequency,
          intervalCount: series.interval_count,
          weekdays: series.weekdays,
          monthAnchor: series.month_anchor,
          recurrenceRule: series.recurrence_rule,
          endsOn: series.ends_on ?? "",
          maxOccurrences: series.max_occurrences,
          occurrencesCreated: series.occurrences_created,
          active: series.active,
          version: series.version,
        }
      : null,
    predecessorId,
    activity: activity.map((entry) => shapeFollowUpActivity(entry, now)),
  };
}

export function followUpDetailToInput(item: FollowUpDetail): FollowUpInput {
  return {
    clientId: item.clientId,
    contactId: item.contact?.id ?? "",
    enquiryId: item.related?.kind === "Enquiry" ? item.related.id : "",
    projectId: item.related?.kind === "Project" ? item.related.id : "",
    followUpType: item.followUpType,
    customType: item.customType,
    title: item.title,
    overview: item.overview,
    notes: item.notes,
    dueDate: item.dueDate,
    dueTime: item.dueTime,
    priority: item.priority,
    contactMethods: item.contactMethods,
    checklist: item.checklist.map(({ id, label, sortOrder }) => ({ id, label, sortOrder })),
    recurrence: item.series
      ? {
          enabled: item.series.active,
          frequency: item.series.frequency,
          intervalCount: item.series.intervalCount,
          weekdays: item.series.weekdays,
          monthAnchor: item.series.monthAnchor,
          endsOn: item.series.endsOn,
          maxOccurrences: item.series.maxOccurrences,
        }
      : {
          enabled: false,
          frequency: "Weekly",
          intervalCount: 1,
          weekdays: [],
          monthAnchor: null,
          endsOn: "",
          maxOccurrences: null,
        },
    editScope: item.seriesId ? "occurrence" : "future",
  };
}
