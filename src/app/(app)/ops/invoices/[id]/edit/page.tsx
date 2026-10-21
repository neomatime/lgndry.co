import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CommercialDocumentForm } from "@/features/invoices/components/commercial-document-form";
import { fetchCommercialFormData } from "@/features/invoices/fetch-commercial-options";
import { fetchInvoiceDetail } from "@/features/invoices/fetch-invoice-detail";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Edit Invoice" };

function todayJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOpsUser();
  const { id } = await params;
  const [result, data] = await Promise.all([
    fetchInvoiceDetail(id, todayJohannesburg()),
    fetchCommercialFormData(),
  ]);
  if (result.status === "not-found") notFound();
  if (result.status === "error" || !data)
    return (
      <EmptyState title="Invoice editor temporarily unavailable">
        Try refreshing in a moment.
      </EmptyState>
    );
  if (result.invoice.status !== "Draft" || result.invoice.quoteId) notFound();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Edit Invoice Draft" description={result.invoice.reference} />
      <CommercialDocumentForm kind="invoice" data={data} initial={result.invoice} />
    </div>
  );
}
