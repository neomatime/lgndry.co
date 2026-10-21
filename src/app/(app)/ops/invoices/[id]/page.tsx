import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { InvoiceDetail } from "@/features/invoices/components/invoice-detail";
import { fetchInvoiceDetail } from "@/features/invoices/fetch-invoice-detail";
import { requireOpsUser } from "@/lib/auth/guards";

function todayJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchInvoiceDetail(id, todayJohannesburg());
  return { title: result.status === "ok" ? result.invoice.reference : "Invoice" };
}
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchInvoiceDetail(id, todayJohannesburg());
  if (result.status === "not-found") notFound();
  if (result.status === "error")
    return (
      <EmptyState title="Invoice temporarily unavailable">Try refreshing in a moment.</EmptyState>
    );
  return <InvoiceDetail invoice={result.invoice} />;
}
