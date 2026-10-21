import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CommercialDocumentForm } from "@/features/invoices/components/commercial-document-form";
import { fetchCommercialFormData } from "@/features/invoices/fetch-commercial-options";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New Invoice" };
export default async function NewInvoicePage() {
  await requireOpsUser();
  const data = await fetchCommercialFormData();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader
        title="New Invoice"
        description="Create a ZAR invoice draft linked to a client and their work."
      />
      {data ? (
        <CommercialDocumentForm kind="invoice" data={data} />
      ) : (
        <EmptyState title="Invoice form is temporarily unavailable">
          Try refreshing in a moment.
        </EmptyState>
      )}
    </div>
  );
}
