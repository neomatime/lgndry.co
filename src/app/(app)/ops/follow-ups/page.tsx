import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CalendarDays, CalendarRange, CircleCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { FollowUpsTable } from "@/features/follow-ups/components/follow-ups-table";
import { fetchFollowUps } from "@/features/follow-ups/fetch-follow-ups";
import { summarizeFollowUps, withScheduleStates } from "@/features/follow-ups/list-view-model";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Follow-ups" };

const DESCRIPTION = "Track due actions, reminders, approvals and client check-ins.";

const newFollowUpAction = (
  <Link
    href="/ops/follow-ups/new"
    className="border-ink bg-ink inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium text-white transition-colors hover:bg-black"
  >
    <Plus className="size-4" aria-hidden="true" />
    New Follow-up
  </Link>
);

export default async function FollowUpsPage() {
  const user = await requireOpsUser();
  const fetched = await fetchFollowUps();

  if (fetched === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Follow-ups" description={DESCRIPTION} actions={newFollowUpAction} />
        <EmptyState title="Follow-ups are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  // One instant for the whole request: scheduling states, the week metrics and the due
  // labels the client renders are all measured against it, so they can never disagree.
  const now = new Date();
  const rows = withScheduleStates(fetched, now);
  const stats = summarizeFollowUps(rows, now);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Follow-ups" description={DESCRIPTION} actions={newFollowUpAction} />
      {rows.length === 0 ? (
        <EmptyState title="No follow-ups yet">
          Nothing is scheduled.{" "}
          <Link href="/ops/follow-ups/new" className="text-ink font-medium underline">
            Create the first follow-up
          </Link>{" "}
          to keep track of the next action for a client, enquiry or project.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={CalendarDays} label="Due Today" value={stats.dueToday} />
            <StatCard icon={AlarmClock} label="Overdue" value={stats.overdue} />
            <StatCard icon={CalendarRange} label="Due This Week" value={stats.dueThisWeek} />
            <StatCard
              icon={CircleCheck}
              label="Completed This Week"
              value={stats.completedThisWeek}
            />
          </div>
          <FollowUpsTable rows={rows} now={now.toISOString()} currentUserId={user.id} />
        </>
      )}
    </div>
  );
}
