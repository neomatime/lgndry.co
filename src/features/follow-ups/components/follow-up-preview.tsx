import { Check } from "lucide-react";
import Link from "next/link";
import {
  PriorityBadge,
  ScheduleStateBadge,
} from "@/features/follow-ups/components/follow-up-badges";
import { formatDueFull, formatJohannesburgDay } from "@/features/follow-ups/due-label";
import { checklistProgress } from "@/features/follow-ups/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

export function relatedHref(related: NonNullable<FollowUpListItem["related"]>) {
  return related.kind === "Enquiry"
    ? `/ops/enquiries/${related.id}`
    : `/ops/projects/${related.id}`;
}

/** Inline preview for the checkbox-selected row. Read-only: lifecycle actions live on the detail page. */
export function FollowUpPreview({ followUp }: { followUp: FollowUpListItem }) {
  const progress = checklistProgress(followUp);
  const closedOn =
    followUp.status === "Completed" && followUp.completedAt
      ? { label: "Completed", day: formatJohannesburgDay(followUp.completedAt) }
      : followUp.status === "Cancelled" && followUp.cancelledAt
        ? { label: "Cancelled", day: formatJohannesburgDay(followUp.cancelledAt) }
        : null;

  return (
    <section
      aria-label={`${followUp.reference} preview`}
      className="border-line grid gap-6 border p-6 md:grid-cols-2 xl:grid-cols-3"
    >
      <div className="min-w-0 md:col-span-2 xl:col-span-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-medium">{followUp.title}</h3>
            <p className="text-ink-muted mt-1 text-sm">
              <Link href={`/ops/clients/${followUp.clientId}`} className="hover:underline">
                {followUp.clientName}
              </Link>
              {followUp.contact ? (
                <>
                  {" · "}
                  {followUp.contact.fullName}
                  {followUp.contact.role ? `, ${followUp.contact.role}` : ""}
                </>
              ) : null}
            </p>
          </div>
          <Link
            href={`/ops/follow-ups/${followUp.id}`}
            className="shrink-0 text-sm font-medium underline"
          >
            View Follow-up
          </Link>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-medium">Details</h3>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-muted">Reference</dt>
            <dd>{followUp.reference}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-muted">Type</dt>
            <dd className="text-right">{followUp.displayType}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-muted">Due</dt>
            <dd className="text-right">{formatDueFull(followUp.dueDate, followUp.dueTime)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <ScheduleStateBadge state={followUp.scheduleState} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Priority</dt>
            <dd>
              <PriorityBadge priority={followUp.priority} />
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-muted">Contact method</dt>
            <dd className="text-right">
              {followUp.contactMethods.length ? followUp.contactMethods.join(", ") : "Not set"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-muted">Owner</dt>
            <dd className="text-right">{followUp.owner.name || "Unassigned"}</dd>
          </div>
          {followUp.related ? (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-muted">{followUp.related.kind}</dt>
              <dd className="text-right">
                <Link href={relatedHref(followUp.related)} className="underline">
                  {followUp.related.label}
                </Link>
              </dd>
            </div>
          ) : null}
          {closedOn && closedOn.day ? (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-muted">{closedOn.label}</dt>
              <dd className="text-right">{closedOn.day}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-medium">Overview</h3>
        <p className="text-ink-muted mt-2 text-sm whitespace-pre-line">
          {followUp.overview || "No overview has been added."}
        </p>
        {followUp.notes ? (
          <>
            <h3 className="mt-4 text-sm font-medium">Notes</h3>
            <p className="text-ink-muted mt-2 text-sm whitespace-pre-line">{followUp.notes}</p>
          </>
        ) : null}
        {followUp.status === "Completed" && followUp.outcome ? (
          <>
            <h3 className="mt-4 text-sm font-medium">Outcome</h3>
            <p className="text-ink-muted mt-2 text-sm whitespace-pre-line">{followUp.outcome}</p>
          </>
        ) : null}
        {followUp.status === "Cancelled" && followUp.cancellationReason ? (
          <>
            <h3 className="mt-4 text-sm font-medium">Cancellation reason</h3>
            <p className="text-ink-muted mt-2 text-sm whitespace-pre-line">
              {followUp.cancellationReason}
            </p>
          </>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-4 text-sm">
          <h3 className="font-medium">Checklist</h3>
          {progress.total ? (
            <span className="text-ink-muted">
              {progress.completed}/{progress.total}
            </span>
          ) : null}
        </div>
        {progress.total ? (
          <>
            <div className="bg-line mt-2 h-1.5 overflow-hidden" aria-hidden="true">
              <div className="bg-ink h-full" style={{ width: `${progress.percent}%` }} />
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {followUp.checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="border-ink mt-0.5 flex size-4 shrink-0 items-center justify-center border"
                  >
                    {item.isCompleted ? <Check className="size-3" /> : null}
                  </span>
                  <span className={item.isCompleted ? "text-ink-muted line-through" : undefined}>
                    {item.label}
                    <span className="sr-only">{item.isCompleted ? " (done)" : " (not done)"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-ink-muted mt-2 text-sm">No checklist items.</p>
        )}
      </div>
    </section>
  );
}
