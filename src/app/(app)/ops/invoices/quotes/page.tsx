import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { QuotesTable } from "@/features/invoices/components/quotes-table";
import { fetchQuotes } from "@/features/invoices/fetch-quotes";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Quotes" };
export default async function QuotesPage() {
  await requireOpsUser();
  const rows = await fetchQuotes();
  const actions = (
    <div className="flex gap-2">
      <Link
        href="/ops/invoices"
        className="border-line-strong inline-flex h-10 items-center border px-4 text-sm font-medium"
      >
        Invoices
      </Link>
      <Link
        href="/ops/invoices/quotes/new"
        className="bg-ink inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white"
      >
        <Plus className="size-4" />
        New Quote
      </Link>
    </div>
  );
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Quotes"
        description="Prepare, send and track client-approved commercial proposals."
        actions={actions}
      />
      {rows === null ? (
        <EmptyState title="Quotes are temporarily unavailable">
          Try refreshing in a moment.
        </EmptyState>
      ) : rows.length ? (
        <QuotesTable rows={rows} />
      ) : (
        <EmptyState title="No quotes yet">
          Create the first quote to begin the approval and deposit workflow.
        </EmptyState>
      )}
    </div>
  );
}
