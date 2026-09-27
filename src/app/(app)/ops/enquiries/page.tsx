import type { Metadata } from "next";
import { FileText, Mail, Eye, Paperclip } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { EnquiriesTable } from "@/features/enquiries/components/enquiries-table";
import { computeEnquiryStats } from "@/features/enquiries/list-view-model";
import { fetchEnquiries } from "@/features/enquiries/fetch-enquiries";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  await requireOpsUser();
  const rows = await fetchEnquiries();

  if (rows === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Enquiries" description="Track incoming project requests." />
        <EmptyState title="Enquiries are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const stats = computeEnquiryStats(rows);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Enquiries"
        description="Track incoming project requests and attachments."
      />
      {rows.length === 0 ? (
        <EmptyState title="No enquiries yet">
          Submissions from /start-a-project will appear here.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Mail} label="New Enquiries" value={stats.New} />
            <StatCard icon={Eye} label="Reviewing" value={stats.Reviewing} />
            <StatCard icon={FileText} label="Quoted" value={stats.Quoted} />
            <StatCard
              icon={Paperclip}
              label="Missing Attachments"
              value={stats.missingAttachments}
            />
          </div>
          <EnquiriesTable rows={rows} />
        </>
      )}
    </div>
  );
}
