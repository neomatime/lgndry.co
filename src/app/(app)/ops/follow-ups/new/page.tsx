import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FollowUpForm } from "@/features/follow-ups/components/follow-up-form";
import { fetchFollowUpFormOptions } from "@/features/follow-ups/fetch-follow-up-form-data";
import {
  resolveFollowUpContext,
  type FollowUpContextParams,
} from "@/features/follow-ups/follow-up-context";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New Follow-up" };
type Props = { searchParams: Promise<FollowUpContextParams> };

export default async function NewFollowUpPage({ searchParams }: Props) {
  await requireOpsUser();
  const [query, clients] = await Promise.all([searchParams, fetchFollowUpFormOptions()]);
  const header = (
    <PageHeader
      title="New Follow-up"
      description="Schedule the next action for a client, enquiry or project."
    />
  );
  if (!clients) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState title="Follow-up form is temporarily unavailable">
          Something went wrong loading client options. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }
  // The URL is untrusted: it only pre-fills what the server-loaded options confirm.
  const context = resolveFollowUpContext(query, clients);
  return (
    <div className="flex flex-col gap-8">
      {header}
      <FollowUpForm
        clients={clients}
        defaultClientId={context.clientId}
        defaultContactId={context.contactId}
        defaultEnquiryId={context.enquiryId}
        defaultProjectId={context.projectId}
        contextNotice={context.notice}
      />
    </div>
  );
}
