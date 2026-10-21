import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CommercialDocumentForm } from "@/features/invoices/components/commercial-document-form";
import { fetchCommercialFormData } from "@/features/invoices/fetch-commercial-options";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New Quote" };
export default async function NewQuotePage() {
  await requireOpsUser();
  const data = await fetchCommercialFormData();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader
        title="New Quote"
        description="Create a client-ready quote with line items, discount, terms and booking retainer."
      />
      {data ? (
        <CommercialDocumentForm kind="quote" data={data} />
      ) : (
        <EmptyState title="Quote form is temporarily unavailable">
          Try refreshing in a moment.
        </EmptyState>
      )}
    </div>
  );
}
