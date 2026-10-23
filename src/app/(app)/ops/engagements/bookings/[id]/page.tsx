import { Calendar, Clock, MapPin, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { EngagementEditor } from "@/features/engagements/components/engagement-editor";
import { fetchBookingDetail } from "@/features/engagements/fetch-engagement-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };
const dateFormat = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "long",
  timeZone: "Africa/Johannesburg",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchBookingDetail(id);
  return {
    title:
      result.status === "ok" ? `${result.record.client?.name ?? "Booking"} Booking` : "Booking",
  };
}

export default async function BookingDetailPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchBookingDetail(id);
  if (result.status === "not-found") notFound();
  if (result.status === "error")
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Booking" description="Manage a booking request." />
        <EmptyState title="This booking is temporarily unavailable">
          Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  const booking = result.record;
  return (
    <div className="flex flex-col gap-8">
      <div className="text-ink-muted flex gap-1 text-sm">
        <Link href="/ops/engagements" className="underline">
          Bookings
        </Link>
        <span>/</span>
        <span>{booking.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <PageHeader
        title={`${booking.client?.name ?? booking.contact?.name ?? "Booking"} Session`}
        description={booking.service}
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
        <StatCard
          icon={Calendar}
          label="Requested Date"
          value={
            booking.date
              ? dateFormat.format(new Date(`${booking.date}T12:00:00+02:00`))
              : "Unscheduled"
          }
        />
        <StatCard icon={Clock} label="Requested Time" value={booking.start ?? "Open"} />
        <StatCard icon={MapPin} label="Location" value={booking.location ?? "Not supplied"} />
        <StatCard icon={Wallet} label="Deposit" value={booking.deposit} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-5">
          <section className="border-line border p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">Booking request</h2>
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-ink-muted mt-4 whitespace-pre-wrap">
              {booking.projectDetails ?? "No project details were supplied."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {booking.services.map((service) => (
                <span key={service} className="bg-surface-soft px-3 py-1 text-sm">
                  {service}
                </span>
              ))}
            </div>
          </section>
          <EngagementEditor record={booking} />
        </div>
        <aside className="flex flex-col gap-5">
          <section className="border-line border p-5">
            <h2 className="font-medium">Contact</h2>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div>
                <dt>Client</dt>
                <dd className="text-ink">{booking.client?.name ?? "Not linked"}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd className="text-ink">{booking.contact?.name ?? "Not linked"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="text-ink break-all">
                  {booking.contact?.email ?? booking.client?.email ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd className="text-ink">
                  {booking.contact?.phone ?? booking.client?.phone ?? "—"}
                </dd>
              </div>
            </dl>
          </section>
          <section className="border-line border p-5">
            <h2 className="font-medium">Operations</h2>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div>
                <dt>Date flexibility</dt>
                <dd className="text-ink">{booking.dateFlexibility ?? "—"}</dd>
              </div>
              <div>
                <dt>Budget range</dt>
                <dd className="text-ink">{booking.budgetRange ?? "—"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd className="text-ink">{booking.ownerName ?? "Unassigned"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
