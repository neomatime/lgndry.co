import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FollowUpDetailView } from "@/features/follow-ups/components/follow-up-detail";
import { fetchFollowUpDetail } from "@/features/follow-ups/fetch-follow-up-detail";
import { fetchLinkedArchived } from "@/features/follow-ups/fetch-linked-archived";
import { getScheduleState } from "@/features/follow-ups/list-view-model";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchFollowUpDetail(id);
  if (result.status !== "ok") return { title: "Follow-up" };
  return { title: `${result.followUp.reference} ${result.followUp.title}` };
}

export default async function FollowUpDetailPage({ params, searchParams }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchFollowUpDetail(id);

  if (result.status === "not-found") notFound();

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Follow-up"
          description="Track due actions, reminders, approvals and client check-ins."
          actions={
            <Link
              href="/ops/follow-ups"
              className="border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center gap-2 border bg-white px-4 text-sm font-medium transition-colors"
            >
              Back to Follow-ups
            </Link>
          }
        />
        <EmptyState title="This follow-up is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  // One instant for the whole request: the scheduling state computed here and the due labels the
  // client renders are both measured against it, so they can never disagree.
  const now = new Date();
  const followUp = {
    ...result.followUp,
    scheduleState: getScheduleState(
      result.followUp.status,
      result.followUp.dueDate,
      result.followUp.dueTime,
      now,
    ),
  };
  const [archived, query] = await Promise.all([
    fetchLinkedArchived({
      clientId: followUp.clientId,
      contactId: followUp.contact?.id,
      enquiryId: followUp.related?.kind === "Enquiry" ? followUp.related.id : undefined,
      projectId: followUp.related?.kind === "Project" ? followUp.related.id : undefined,
    }),
    searchParams,
  ]);
  const updated = (Array.isArray(query.updated) ? query.updated[0] : query.updated) === "1";

  return (
    <FollowUpDetailView
      followUp={followUp}
      now={now.toISOString()}
      archived={archived}
      updated={updated}
    />
  );
}
