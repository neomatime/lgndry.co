import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ClientDetailView } from "@/features/clients/components/client-detail";
import { fetchClientDetail } from "@/features/clients/fetch-client-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchClientDetail(id);
  return { title: result.status === "ok" ? `${result.client.name} Client` : "Client" };
}

export default async function ClientDetailPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchClientDetail(id);

  if (result.status === "not-found") notFound();

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Client" description="Manage client relationships and contacts." />
        <EmptyState title="This client is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  return <ClientDetailView client={result.client} />;
}
