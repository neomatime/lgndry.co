import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CommercialDocumentForm } from "@/features/invoices/components/commercial-document-form";
import { fetchCommercialFormData } from "@/features/invoices/fetch-commercial-options";
import { fetchQuoteDetail } from "@/features/invoices/fetch-quote-detail";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Edit Quote" };
export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOpsUser();
  const { id } = await params;
  const [result, data] = await Promise.all([fetchQuoteDetail(id), fetchCommercialFormData()]);
  if (result.status === "not-found") notFound();
  if (result.status === "error" || !data)
    return (
      <EmptyState title="Quote editor temporarily unavailable">
        Try refreshing in a moment.
      </EmptyState>
    );
  if (result.quote.status !== "Draft") notFound();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Edit Quote Draft" description={result.quote.reference} />
      <CommercialDocumentForm kind="quote" data={data} initial={result.quote} />
    </div>
  );
}
