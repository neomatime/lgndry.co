import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { QuoteDetail } from "@/features/invoices/components/quote-detail";
import { fetchQuoteDetail } from "@/features/invoices/fetch-quote-detail";
import { requireOpsUser } from "@/lib/auth/guards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchQuoteDetail(id);
  return { title: result.status === "ok" ? result.quote.reference : "Quote" };
}
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchQuoteDetail(id);
  if (result.status === "not-found") notFound();
  if (result.status === "error")
    return (
      <EmptyState title="Quote temporarily unavailable">Try refreshing in a moment.</EmptyState>
    );
  return <QuoteDetail quote={result.quote} />;
}
