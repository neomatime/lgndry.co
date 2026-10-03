import { sortFollowUps, withScheduleStates } from "@/features/follow-ups/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

/**
 * A parent record's follow-ups, shaped once on the server for display on its detail page.
 *
 * `now` is the single server-chosen instant (ISO string) that every scheduling state in this
 * object was evaluated against; the presentational component reuses it for date labels so it
 * never reads a browser clock and the server render and hydration always agree.
 */
export type RelatedFollowUps = {
  now: string;
  /** Overdue, Due Today and Upcoming, in due order (Overdue first). */
  actionable: FollowUpListItem[];
  /** Most recently completed first. */
  completed: FollowUpListItem[];
  /** Most recently cancelled first. */
  cancelled: FollowUpListItem[];
  total: number;
};

export function buildRelatedFollowUps(rows: FollowUpListItem[], now: Date): RelatedFollowUps {
  const sorted = sortFollowUps(withScheduleStates(rows, now), "due-soonest");
  return {
    now: now.toISOString(),
    actionable: sorted.filter(
      (row) =>
        row.scheduleState === "Overdue" ||
        row.scheduleState === "Today" ||
        row.scheduleState === "Upcoming",
    ),
    completed: sorted.filter((row) => row.scheduleState === "Completed"),
    cancelled: sorted.filter((row) => row.scheduleState === "Cancelled"),
    total: rows.length,
  };
}

/**
 * Everything a detail page needs to render its follow-ups section: the grouped rows plus the
 * facts that decide whether Add may be offered. Composed by each parent's detail-page loader,
 * so the parent's own detail model (shared with its edit page) is left untouched.
 */
export type ParentFollowUps = {
  related: RelatedFollowUps;
  archived: boolean;
  /** `null` for a legacy record that was never linked to a client. */
  clientId: string | null;
  clientArchived: boolean;
};

export function buildParentFollowUps(
  rows: FollowUpListItem[],
  now: Date,
  parent: { archived: boolean; clientId: string | null; clientArchived: boolean },
): ParentFollowUps {
  return {
    related: buildRelatedFollowUps(rows, now),
    archived: parent.archived,
    clientId: parent.clientId,
    clientArchived: parent.clientArchived,
  };
}

export type RelatedSubject = "client" | "enquiry" | "project";

export type RelatedAddAvailability = { canAdd: true } | { canAdd: false; reason: string };

/**
 * Whether the create form can be pre-filled for this parent. The form's option lists exclude
 * archived clients, enquiries and projects, and its context check rejects any link that names
 * a record outside them (pre-filling nothing), so an Add link is only offered when every
 * record it would name is live. Archiving a client does not archive its enquiries or projects,
 * which is why the client's own flag matters for the other two.
 */
export function relatedAddAvailability(
  subject: RelatedSubject,
  parent: { archived: boolean; clientId: string | null; clientArchived: boolean },
): RelatedAddAvailability {
  if (parent.archived)
    return {
      canAdd: false,
      reason: `This ${subject} is archived, so new follow-ups can't be added. Restore it to add one.`,
    };
  if (!parent.clientId)
    return {
      canAdd: false,
      reason: `A follow-up needs a client, and this ${subject} isn't linked to one, so one can't be added from here.`,
    };
  if (parent.clientArchived && subject !== "client")
    return {
      canAdd: false,
      reason:
        "This client is archived, so new follow-ups can't be added. Restore the client to add one.",
    };
  return { canAdd: true };
}
