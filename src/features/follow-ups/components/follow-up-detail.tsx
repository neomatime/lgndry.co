"use client";

import { Calendar, Clock, FileText, Flag, Folder, Mail, Pencil, Phone, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import {
  FollowUpChecklist,
  ProgressSummary,
} from "@/features/follow-ups/components/follow-up-checklist";
import {
  PriorityBadge,
  ScheduleStateBadge,
} from "@/features/follow-ups/components/follow-up-badges";
import {
  FollowUpLifecycleControl,
  ReopenBlockedNote,
  type LifecycleNotice,
} from "@/features/follow-ups/components/follow-up-lifecycle-control";
import { relatedHref } from "@/features/follow-ups/components/follow-up-preview";
import { formatDueFull, formatDueLabel } from "@/features/follow-ups/due-label";
import type { LinkedArchivedStatus } from "@/features/follow-ups/fetch-linked-archived";
import { checklistProgress } from "@/features/follow-ups/list-view-model";
import { recurrenceSummary } from "@/features/follow-ups/recurrence";
import { formatJohannesburgTimestamp } from "@/features/follow-ups/timestamp-label";
import type { FollowUpDetail } from "@/features/follow-ups/types";

const secondaryLink =
  "border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center gap-2 border bg-white px-4 text-sm font-medium transition-colors";
const card = "border-line min-w-0 border p-5";
const rowClass = "flex items-start justify-between gap-4";

function SummaryCard({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-line flex min-w-0 items-center gap-3 border p-4">
      <span className="bg-surface-soft flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-ink-muted text-xs">{label}</p>
        <div className="text-sm font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

function ArchivedTag({ archived }: { archived: boolean }) {
  return archived ? <span className="text-ink-muted text-xs font-normal"> (Archived)</span> : null;
}

function Prose({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="font-medium">{title}</h2>
      <div className="text-ink-muted mt-2 text-sm break-words whitespace-pre-line">{children}</div>
    </section>
  );
}

/**
 * The follow-up detail page body. The server hands it one `now` (ISO) so the due labels agree
 * with the scheduling state it computed; nothing here reads the clock while rendering, and every
 * date is formatted in Africa/Johannesburg.
 */
export function FollowUpDetailView({
  followUp,
  now,
  archived,
  updated = false,
}: {
  followUp: FollowUpDetail;
  now: string;
  archived: LinkedArchivedStatus;
  /** Set when the page was reached right after saving an edit (`?updated=1`). */
  updated?: boolean;
}) {
  const nowDate = useMemo(() => new Date(now), [now]);
  const [notice, setNotice] = useState<LifecycleNotice | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // After a lifecycle action the control that opened the dialog may be gone (Mark Complete
  // disappears once the follow-up is Completed), so focus lands on the page title instead.
  useEffect(() => {
    if (notice) heading.current?.focus();
  }, [notice]);

  const open = followUp.status === "Open";
  const progress = checklistProgress(followUp);
  const related = followUp.related;
  const relatedArchived =
    related?.kind === "Enquiry"
      ? archived.enquiry
      : related?.kind === "Project" && archived.project;
  const owner = followUp.owner.name || followUp.owner.email || "Unassigned";
  const series = followUp.series;

  const overview = (
    <div className="flex flex-col gap-6">
      <Prose title="Follow-up Overview">{followUp.overview || "No overview has been added."}</Prose>
      {progress.total > 0 ? (
        <section className="min-w-0">
          <h2 className="font-medium">Action Checklist</h2>
          <div className="mt-2">
            <ProgressSummary {...progress} />
          </div>
          {open ? (
            <p className="text-ink-muted mt-2 text-xs">Update items from the Checklist tab.</p>
          ) : null}
        </section>
      ) : null}
      {followUp.notes ? <Prose title="Notes">{followUp.notes}</Prose> : null}
      {followUp.status === "Completed" ? (
        <Prose title="Outcome">
          {followUp.completedAt ? (
            <span className="block">
              Completed {formatJohannesburgTimestamp(followUp.completedAt)}
            </span>
          ) : null}
          {followUp.outcome || "No outcome note was added."}
        </Prose>
      ) : null}
      {followUp.status === "Cancelled" ? (
        <Prose title="Cancellation reason">
          {followUp.cancelledAt ? (
            <span className="block">
              Cancelled {formatJohannesburgTimestamp(followUp.cancelledAt)}
            </span>
          ) : null}
          {followUp.cancellationReason || "No reason was recorded."}
        </Prose>
      ) : null}
    </div>
  );

  const checklist = <FollowUpChecklist items={followUp.checklist} editable={open} />;

  const history =
    followUp.activity.length === 0 ? (
      <p className="text-ink-muted text-sm">No activity recorded yet.</p>
    ) : (
      <ol className="flex flex-col gap-4">
        {followUp.activity.map((entry) => (
          <li key={entry.id} className="border-line min-w-0 border-l-2 pl-4 text-sm">
            <p className="break-words">{entry.message}</p>
            <p className="text-ink-muted mt-0.5 text-xs">
              {formatJohannesburgTimestamp(entry.createdAt)} · {entry.relativeTime}
            </p>
          </li>
        ))}
      </ol>
    );

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-ink-muted flex items-center gap-1 text-sm">
        <Link href="/ops/follow-ups" className="hover:text-ink underline">
          Follow-ups
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{followUp.reference}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-3xl font-medium tracking-tight break-words outline-none"
          >
            {followUp.title}
          </h1>
          <p className="text-ink-muted mt-1.5 text-sm break-words">
            {followUp.contact
              ? `${followUp.contact.fullName}${followUp.contact.role ? ` · ${followUp.contact.role}` : ""}`
              : followUp.clientName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link href="/ops/follow-ups" className={secondaryLink}>
            Back to Follow-ups
          </Link>
          {open ? (
            <Link href={`/ops/follow-ups/${followUp.id}/edit`} className={secondaryLink}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit Follow-up
            </Link>
          ) : null}
          <FollowUpLifecycleControl followUp={followUp} onDone={setNotice} />
        </div>
      </div>

      <ReopenBlockedNote followUp={followUp} />

      <div role="status" className="empty:hidden">
        {notice ? (
          <div className="border-line-strong flex flex-wrap items-center gap-x-4 gap-y-1 border p-4 text-sm">
            <p className="min-w-0 break-words">{notice.message}</p>
            {notice.successorId ? (
              <Link
                href={`/ops/follow-ups/${notice.successorId}`}
                className="font-medium underline"
              >
                View next occurrence
              </Link>
            ) : null}
          </div>
        ) : updated ? (
          <div className="border-line-strong border p-4 text-sm">Follow-up updated.</div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard icon={FileText} label="Type">
          {followUp.displayType}
        </SummaryCard>
        <SummaryCard icon={Clock} label="Status">
          <ScheduleStateBadge state={followUp.scheduleState} />
        </SummaryCard>
        <SummaryCard icon={Flag} label="Priority">
          <PriorityBadge priority={followUp.priority} />
        </SummaryCard>
        <SummaryCard icon={Calendar} label="Due">
          <span title={formatDueFull(followUp.dueDate, followUp.dueTime)}>
            {formatDueLabel(followUp.dueDate, followUp.dueTime, nowDate)}
          </span>
        </SummaryCard>
        <SummaryCard icon={User} label="Owner">
          {owner}
        </SummaryCard>
        <SummaryCard icon={Folder} label="Related Item">
          {related ? (
            <>
              <Link href={relatedHref(related)} className="underline">
                {related.label}
              </Link>
              <span className="text-ink-muted block text-xs font-normal">
                {related.kind}
                {relatedArchived ? " (Archived)" : ""}
              </span>
            </>
          ) : (
            <span className="text-ink-muted font-normal">None</span>
          )}
        </SummaryCard>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Tabs
            items={[
              { id: "overview", label: "Overview", content: overview },
              { id: "checklist", label: "Checklist", content: checklist },
              { id: "history", label: "History", content: history },
            ]}
          />
        </div>

        <aside aria-label="Follow-up details" className="flex min-w-0 flex-col gap-6">
          <section className={card}>
            <h2 className="font-medium">Follow-up Details</h2>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div className={rowClass}>
                <dt>Reference</dt>
                <dd className="text-ink text-right break-all">{followUp.reference}</dd>
              </div>
              <div className={rowClass}>
                <dt>Client</dt>
                <dd className="text-ink min-w-0 text-right break-words">{followUp.clientName}</dd>
              </div>
              <div className={rowClass}>
                <dt>Contact method</dt>
                <dd className="text-ink min-w-0 text-right break-words">
                  {followUp.contactMethods.length ? followUp.contactMethods.join(", ") : "Not set"}
                </dd>
              </div>
            </dl>
          </section>

          {followUp.contact ? (
            <section className={card} aria-labelledby="fu-contact-heading">
              <h2 id="fu-contact-heading" className="font-medium">
                Contact Details
              </h2>
              <p className="mt-3 text-sm font-medium break-words">
                {followUp.contact.fullName}
                <ArchivedTag archived={archived.contact} />
              </p>
              {followUp.contact.role ? (
                <p className="text-ink-muted text-sm break-words">{followUp.contact.role}</p>
              ) : null}
              <ul className="mt-3 space-y-2 text-sm">
                {followUp.contact.email ? (
                  <li className="flex min-w-0 items-start gap-2">
                    <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <a href={`mailto:${followUp.contact.email}`} className="break-all underline">
                      {followUp.contact.email}
                    </a>
                  </li>
                ) : null}
                {followUp.contact.phone ? (
                  <li className="flex min-w-0 items-start gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <a href={`tel:${followUp.contact.phone}`} className="break-all underline">
                      {followUp.contact.phone}
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          <section className={card} aria-labelledby="fu-linked-heading">
            <h2 id="fu-linked-heading" className="font-medium">
              Linked Records
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className={rowClass}>
                <span className="text-ink-muted">Client</span>
                <span className="min-w-0 text-right break-words">
                  <Link href={`/ops/clients/${followUp.clientId}`} className="underline">
                    {followUp.clientName}
                  </Link>
                  <ArchivedTag archived={archived.client} />
                </span>
              </li>
              {related ? (
                <li className={rowClass}>
                  <span className="text-ink-muted">{related.kind}</span>
                  <span className="min-w-0 text-right break-words">
                    <Link href={relatedHref(related)} className="underline">
                      {related.label}
                    </Link>
                    <ArchivedTag archived={Boolean(relatedArchived)} />
                  </span>
                </li>
              ) : null}
            </ul>
          </section>

          {series ? (
            <section className={card} aria-labelledby="fu-recurrence-heading">
              <h2 id="fu-recurrence-heading" className="font-medium">
                Recurrence
              </h2>
              <dl className="text-ink-muted mt-3 space-y-2 text-sm">
                <div className={rowClass}>
                  <dt>Repeats</dt>
                  <dd className="text-ink min-w-0 text-right break-words">
                    {recurrenceSummary({ ...series, enabled: true })}
                  </dd>
                </div>
                <div className={rowClass}>
                  <dt>Occurrence</dt>
                  <dd className="text-ink text-right">
                    #{followUp.occurrenceNumber}
                    {series.maxOccurrences ? ` of ${series.maxOccurrences}` : ""}
                  </dd>
                </div>
                <div className={rowClass}>
                  <dt>Series</dt>
                  <dd className="text-ink text-right">{series.active ? "Active" : "Ended"}</dd>
                </div>
                {followUp.predecessorId ? (
                  <div className={rowClass}>
                    <dt>Previous</dt>
                    <dd className="text-right">
                      <Link
                        href={`/ops/follow-ups/${followUp.predecessorId}`}
                        className="text-ink underline"
                      >
                        View previous occurrence
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {followUp.successorId ? (
                  <div className={rowClass}>
                    <dt>Next</dt>
                    <dd className="text-right">
                      <Link
                        href={`/ops/follow-ups/${followUp.successorId}`}
                        className="text-ink underline"
                      >
                        View next occurrence
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section className={card} aria-labelledby="fu-schedule-heading">
            <h2 id="fu-schedule-heading" className="font-medium">
              Schedule
            </h2>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div className={rowClass}>
                <dt>Due</dt>
                <dd className="text-ink min-w-0 text-right break-words">
                  {formatDueFull(followUp.dueDate, followUp.dueTime)}
                </dd>
              </div>
              {followUp.completedAt ? (
                <div className={rowClass}>
                  <dt>Completed</dt>
                  <dd className="text-ink min-w-0 text-right break-words">
                    {formatJohannesburgTimestamp(followUp.completedAt)}
                  </dd>
                </div>
              ) : null}
              {followUp.cancelledAt ? (
                <div className={rowClass}>
                  <dt>Cancelled</dt>
                  <dd className="text-ink min-w-0 text-right break-words">
                    {formatJohannesburgTimestamp(followUp.cancelledAt)}
                  </dd>
                </div>
              ) : null}
              <div className={rowClass}>
                <dt>Created</dt>
                <dd className="text-ink min-w-0 text-right break-words">
                  {formatJohannesburgTimestamp(followUp.createdAt)}
                </dd>
              </div>
              <div className={rowClass}>
                <dt>Last updated</dt>
                <dd className="text-ink min-w-0 text-right break-words">
                  {formatJohannesburgTimestamp(followUp.updatedAt)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
