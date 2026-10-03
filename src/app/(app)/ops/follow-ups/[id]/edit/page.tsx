import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FollowUpForm } from "@/features/follow-ups/components/follow-up-form";
import { fetchFollowUpDetail } from "@/features/follow-ups/fetch-follow-up-detail";
import { fetchFollowUpFormData } from "@/features/follow-ups/fetch-follow-up-form-data";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchFollowUpFormData(id);
  return {
    title: result.status === "ok" ? `Edit ${result.followUp.values.title}` : "Edit Follow-up",
  };
}

export default async function EditFollowUpPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const [result, detail] = await Promise.all([fetchFollowUpFormData(id), fetchFollowUpDetail(id)]);
  if (result.status === "not-found") notFound();
  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Edit Follow-up" description="Update the details of this follow-up." />
        <EmptyState title="This follow-up is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }
  // Only open follow-ups can be edited; send finished ones back to read-only detail.
  if (detail.status === "ok" && detail.followUp.status !== "Open")
    redirect(`/ops/follow-ups/${id}`);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Edit ${result.followUp.values.title}`}
        description="Update the details of this follow-up."
      />
      {/* Keyed by version so "Load latest version" after a conflict remounts with fresh values. */}
      <FollowUpForm
        key={`${result.followUp.id}:${result.followUp.version}`}
        clients={result.clients}
        existingFollowUp={result.followUp}
      />
    </div>
  );
}
