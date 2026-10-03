import { Plus } from "lucide-react";
import Link from "next/link";
import {
  PriorityBadge,
  ScheduleStateBadge,
} from "@/features/follow-ups/components/follow-up-badges";
import { relatedHref } from "@/features/follow-ups/components/follow-up-preview";
import { formatDueLabel, formatJohannesburgDay } from "@/features/follow-ups/due-label";
import type {
  RelatedFollowUps as RelatedFollowUpsData,
  RelatedSubject,
} from "@/features/follow-ups/related-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

export type AddFollowUpParams = {
  clientId: string;
  contactId?: string;
  enquiryId?: string;
  projectId?: string;
};

/**
 * The exact query the create form reads (`clientId`, `contactId`, `enquiryId`, `projectId`).
 * An enquiry and a project are never sent together: the form's context check rejects that
 * pairing and would pre-fill nothing.
 */
export function addFollowUpHref(params: AddFollowUpParams) {
  const query = new URLSearchParams();
  for (const key of ["clientId", "contactId", "enquiryId", "projectId"] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  return `/ops/follow-ups/new?${query.toString()}`;
}

function ClosedNote({ followUp }: { followUp: FollowUpListItem }) {
  const stamp =
    followUp.status === "Completed"
      ? { label: "Completed", at: followUp.completedAt }
      : followUp.status === "Cancelled"
        ? { label: "Cancelled", at: followUp.cancelledAt }
        : null;
  const day = stamp?.at ? formatJohannesburgDay(stamp.at) : "";
  return stamp && day ? (
    <>
      {" · "}
      {stamp.label} {day}
    </>
  ) : null;
}

function FollowUpRow({
  followUp,
  now,
  showRelated,
}: {
  followUp: FollowUpListItem;
  now: Date;
  showRelated: boolean;
}) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-muted text-xs">{followUp.reference}</span>
        <ScheduleStateBadge state={followUp.scheduleState} />
        <PriorityBadge priority={followUp.priority} />
      </div>
      <p className="mt-2 text-sm font-medium break-words">
        <Link href={`/ops/follow-ups/${followUp.id}`} className="hover:underline">
          {followUp.title}
        </Link>
      </p>
      <p className="text-ink-muted mt-1 text-sm break-words">
        {followUp.displayType} · Due {formatDueLabel(followUp.dueDate, followUp.dueTime, now)}
        <ClosedNote followUp={followUp} />
      </p>
      {showRelated && followUp.related ? (
        <p className="text-ink-muted mt-1 text-sm break-words">
          {followUp.related.kind}:{" "}
          <Link href={relatedHref(followUp.related)} className="hover:text-ink underline">
            {followUp.related.label}
          </Link>
        </p>
      ) : null}
    </li>
  );
}

function Group({
  title,
  rows,
  now,
  showRelated,
}: {
  title: string;
  rows: FollowUpListItem[];
  now: Date;
  showRelated: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-medium">
        {title} ({rows.length})
      </h3>
      <ul aria-label={title} className="divide-line border-line mt-2 divide-y border-y">
        {rows.map((row) => (
          <FollowUpRow key={row.id} followUp={row} now={now} showRelated={showRelated} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Shared by the Client, Enquiry and Project detail pages. Purely presentational: the rows
 * arrive already grouped, with scheduling states evaluated against the server's `now`.
 * `canAdd` is false for archived parents (and when a client can't be named), in which case
 * `addBlockedReason` says why instead of offering the link.
 */
export function RelatedFollowUps({
  related,
  add,
  canAdd,
  addBlockedReason,
  subject,
  showRelated = false,
}: {
  related: RelatedFollowUpsData;
  add: AddFollowUpParams;
  canAdd: boolean;
  addBlockedReason?: string;
  subject: RelatedSubject;
  /** Show each follow-up's own enquiry/project (useful on the client page, redundant elsewhere). */
  showRelated?: boolean;
}) {
  const now = new Date(related.now);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted text-sm">
          {related.total === 1 ? "1 follow-up" : `${related.total} follow-ups`}
        </p>
        {canAdd ? (
          <Link
            href={addFollowUpHref(add)}
            className="border-ink bg-ink inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Follow-up
          </Link>
        ) : null}
      </div>
      {!canAdd && addBlockedReason ? (
        <p className="border-line-strong border px-4 py-3 text-sm">{addBlockedReason}</p>
      ) : null}

      {related.total === 0 ? (
        <p className="text-ink-muted py-4 text-sm">
          No follow-ups are linked to this {subject} yet.
          {canAdd ? " Add one to keep track of the next step." : ""}
        </p>
      ) : (
        <>
          <Group title="Open" rows={related.actionable} now={now} showRelated={showRelated} />
          <Group title="Completed" rows={related.completed} now={now} showRelated={showRelated} />
          <Group title="Cancelled" rows={related.cancelled} now={now} showRelated={showRelated} />
        </>
      )}
    </div>
  );
}
