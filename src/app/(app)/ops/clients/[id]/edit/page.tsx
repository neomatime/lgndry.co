import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/features/clients/components/client-form";
import { fetchClientDetail } from "@/features/clients/fetch-client-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchClientDetail(id);
  return { title: result.status === "ok" ? `Edit ${result.client.name}` : "Edit Client" };
}

export default async function EditClientPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchClientDetail(id);

  if (result.status === "not-found") notFound();
  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Edit Client" description="Update client and contact details." />
        <EmptyState title="This client is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }
  if (result.client.archived) redirect(`/ops/clients/${result.client.id}`);

  const initialValue = {
    id: result.client.id,
    name: result.client.name,
    type: result.client.type,
    status: result.client.status,
    accountTier: result.client.accountTier,
    industry: result.client.industry ?? "",
    region: result.client.region ?? "",
    clientSince: result.client.clientSince,
    accountOverview: result.client.accountOverview ?? "",
    preferredServices: result.client.preferredServices,
    relationshipNotes: result.client.relationshipNotes ?? "",
    contacts: result.client.contacts,
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Edit ${result.client.name}`}
        description="Update client and contact details."
      />
      <ClientForm mode="edit" initialValue={initialValue} />
    </div>
  );
}
