import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Plus, Star, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { fetchClients } from "@/features/clients/fetch-clients";
import { computeClientStats } from "@/features/clients/list-view-model";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Clients" };

const newClientAction = (
  <Link
    href="/ops/clients/new"
    className="border-ink bg-ink inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium text-white transition-colors hover:bg-black"
  >
    <Plus className="size-4" aria-hidden="true" />
    New Client
  </Link>
);

export default async function ClientsPage() {
  await requireOpsUser();
  const rows = await fetchClients();

  if (rows === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Clients"
          description="Manage client relationships, contacts, enquiries and account status."
          actions={newClientAction}
        />
        <EmptyState title="Clients are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const stats = computeClientStats(rows);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Clients"
        description="Manage client relationships, contacts, enquiries and account status."
        actions={newClientAction}
      />
      {rows.length === 0 ? (
        <EmptyState title="No clients yet">
          Create the first client to begin tracking contacts and linked enquiries.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Active Clients" value={stats.active} />
            <StatCard icon={Star} label="Key Accounts" value={stats.keyAccounts} />
            <StatCard icon={UserPlus} label="New Leads" value={stats.leads} />
            <StatCard icon={Mail} label="Open Enquiries" value={stats.openEnquiries} />
          </div>
          <ClientsTable rows={rows} />
        </>
      )}
    </div>
  );
}
