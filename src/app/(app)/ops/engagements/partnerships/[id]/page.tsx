import { Building2, Handshake, MapPin, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { EngagementEditor } from "@/features/engagements/components/engagement-editor";
import { fetchPartnershipDetail } from "@/features/engagements/fetch-engagement-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchPartnershipDetail(id);
  return { title: result.status === "ok" ? `${result.record.company} Partnership` : "Partnership" };
}

export default async function PartnershipDetailPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchPartnershipDetail(id);
  if (result.status === "not-found") notFound();
  if (result.status === "error")
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Partnership" description="Manage a partnership request." />
        <EmptyState title="This partnership is temporarily unavailable">
          Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  const partnership = result.record;
  return (
    <div className="flex flex-col gap-8">
      <div className="text-ink-muted flex gap-1 text-sm">
        <Link href="/ops/engagements" className="underline">
          Bookings & Partnerships
        </Link>
        <span>/</span>
        <span>{partnership.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <PageHeader
        title={`${partnership.company} Partnership`}
        description={partnership.partnershipType}
        actions={
          <Link
            href="/ops/engagements"
            className="border-line-strong hover:bg-surface-soft inline-flex h-10 items-center border px-4 text-sm font-medium"
          >
            Back to workspace
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Handshake} label="Partnership Type" value={partnership.partnershipType} />
        <StatCard
          icon={Building2}
          label="Industry"
          value={partnership.industry ?? "Not supplied"}
        />
        <StatCard
          icon={MapPin}
          label="Brand Location"
          value={partnership.brandLocation ?? "Not supplied"}
        />
        <StatCard icon={Wallet} label="Budget" value={partnership.budgetRange ?? "Not supplied"} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-5">
          <section className="border-line border p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">Partnership brief</h2>
              <StatusBadge status={partnership.status} />
            </div>
            <p className="text-ink-muted mt-4 whitespace-pre-wrap">
              {partnership.brandGoals ?? "No brand goals were supplied."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {partnership.focusAreas.map((focus) => (
                <span key={focus} className="bg-surface-soft px-3 py-1 text-sm">
                  {focus}
                </span>
              ))}
            </div>
          </section>
          <EngagementEditor record={partnership} />
        </div>
        <aside className="flex flex-col gap-5">
          <section className="border-line border p-5">
            <h2 className="font-medium">Contact</h2>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div>
                <dt>Name</dt>
                <dd className="text-ink">{partnership.contact?.name ?? "Not linked"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd className="text-ink">{partnership.contactRole ?? "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="text-ink break-all">{partnership.contact?.email ?? "—"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd className="text-ink">{partnership.contact?.phone ?? "—"}</dd>
              </div>
            </dl>
          </section>
          <section className="border-line border p-5">
            <h2 className="font-medium">Relationship</h2>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div>
                <dt>Content frequency</dt>
                <dd className="text-ink">{partnership.contentFrequency ?? "—"}</dd>
              </div>
              <div>
                <dt>Brand link</dt>
                <dd className="text-ink break-all">{partnership.brandLink ?? "—"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd className="text-ink">{partnership.ownerName ?? "Unassigned"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
