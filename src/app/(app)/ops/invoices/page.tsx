import type { Metadata } from "next";
import { CalendarDays, CircleDollarSign, FileText, Mail, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { InvoicesTable } from "@/features/invoices/components/invoices-table";
import { InvoiceExportButton } from "@/features/invoices/components/invoice-export-button";
import { fetchInvoices } from "@/features/invoices/fetch-invoices";
import { money, summarizeInvoices } from "@/features/invoices/view-model";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Invoices" };

function todayJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

export default async function InvoicesPage() {
  await requireOpsUser();
  const today = todayJohannesburg();
  const rows = await fetchInvoices(today);
  const actions = (
    <div className="flex flex-wrap gap-2">
      <InvoiceExportButton rows={rows ?? []} />
      <Link
        href="/ops/invoices/quotes"
        className="border-line-strong inline-flex h-10 items-center border px-4 text-sm font-medium"
      >
        Quotes
      </Link>
      <Link
        href="/ops/invoices/new"
        className="bg-ink inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white"
      >
        <Plus className="size-4" aria-hidden="true" />
        New Invoice
      </Link>
    </div>
  );
  if (rows === null)
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Invoices"
          description="Track billing, payment status, outstanding balances and collection follow-ups."
          actions={actions}
        />
        <EmptyState title="Invoices are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  const stats = summarizeInvoices(rows, today);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Track billing, payment status, outstanding balances and collection follow-ups."
        actions={actions}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label="Outstanding Balance" value={money(stats.outstanding)} />
        <StatCard icon={Mail} label="Invoices Sent" value={stats.sent} />
        <StatCard icon={CircleDollarSign} label="Paid This Month" value={stats.paidThisMonth} />
        <StatCard icon={CalendarDays} label="Due This Week" value={stats.dueThisWeek} />
      </div>
      {rows.length ? (
        <InvoicesTable rows={rows} />
      ) : (
        <EmptyState title="No invoices yet">
          Create an invoice directly or send a quote for client approval.
        </EmptyState>
      )}
    </div>
  );
}
