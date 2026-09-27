import { Calendar, FileText, Paperclip, Tag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { EnquiryDetailTabs } from "@/features/enquiries/components/enquiry-detail-tabs";
import { fetchEnquiryDetail } from "@/features/enquiries/fetch-enquiry-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchEnquiryDetail(id);
  if (result.status !== "ok") return { title: "Enquiry" };
  return { title: `${result.enquiry.company ?? result.enquiry.fullName} Enquiry` };
}

export default async function EnquiryDetailPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchEnquiryDetail(id);

  if (result.status === "not-found") notFound();

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Enquiry" description="Track incoming project requests." />
        <EmptyState title="This enquiry is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const { enquiry } = result;

  return (
    <div className="flex flex-col gap-8">
      <div className="text-ink-muted flex items-center gap-1 text-sm">
        <Link href="/ops/enquiries" className="hover:text-ink underline">
          Enquiries
        </Link>
        <span>/</span>
        <span>{enquiry.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <PageHeader
        title={`${enquiry.company ?? enquiry.fullName} Enquiry`}
        description={enquiry.fullName}
        actions={
          <Link href="/ops/enquiries">
            <Button variant="secondary">Back to Enquiries</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Tag} label="Status" value={<StatusBadge status={enquiry.status} />} />
        <StatCard icon={FileText} label="Service Type" value={enquiry.projectType} />
        <StatCard icon={Wallet} label="Budget" value={enquiry.budget ?? "Not specified"} />
        <StatCard icon={Calendar} label="Timeline" value={enquiry.timeline} />
        <StatCard icon={Paperclip} label="Attachments" value={enquiry.attachments.length} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <EnquiryDetailTabs enquiry={enquiry} />

        <div className="flex flex-col gap-6">
          <div className="border-line border p-5">
            <h3 className="font-medium">Enquiry Details</h3>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Enquiry ID</dt>
                <dd className="text-ink">{enquiry.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Client</dt>
                <dd className="text-ink">{enquiry.company ?? "Individual"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Contact</dt>
                <dd className="text-ink">{enquiry.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Project Type</dt>
                <dd className="text-ink">{enquiry.projectType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Source</dt>
                <dd className="text-ink">{enquiry.source}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Location</dt>
                <dd className="text-ink">{enquiry.location}</dd>
              </div>
            </dl>
          </div>

          <div className="border-line border p-5">
            <h3 className="font-medium">Contact Details</h3>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Name</dt>
                <dd className="text-ink">{enquiry.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${enquiry.email}`} className="text-ink underline">
                    {enquiry.email}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${enquiry.phone}`} className="text-ink underline">
                    {enquiry.phone}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Company</dt>
                <dd className="text-ink">{enquiry.company ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
