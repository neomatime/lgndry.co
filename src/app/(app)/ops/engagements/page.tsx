import { BadgeCheck, CalendarClock, CalendarRange, Handshake } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { EngagementsWorkspace } from "@/features/engagements/components/engagements-workspace";
import { fetchEngagements } from "@/features/engagements/fetch-engagements";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Bookings" };

function todayInJohannesburg() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function EngagementsPage() {
  await requireOpsUser();
  const data = await fetchEngagements();
  if (!data)
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Bookings"
          description="Manage booking requests, brand partnerships and the studio calendar."
        />
        <EmptyState title="Bookings are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );

  const tentative = data.bookings.filter(
    (item) => item.date && !["Confirmed", "Completed", "Cancelled"].includes(item.status),
  ).length;
  const confirmed = data.bookings.filter((item) => item.status === "Confirmed").length;
  const openPartnerships = data.partnerships.filter(
    (item) => !["Closed", "Declined"].includes(item.status),
  ).length;
  const newRequests = data.bookings.filter((item) => item.status === "New").length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Bookings"
        description="Manage session requests, brand relationships and LGNDRY.Co's working calendar."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarRange} label="New Booking Requests" value={newRequests} />
        <StatCard icon={CalendarClock} label="Tentative Dates" value={tentative} />
        <StatCard icon={BadgeCheck} label="Confirmed Bookings" value={confirmed} />
        <StatCard icon={Handshake} label="Open Partnerships" value={openPartnerships} />
      </div>
      {data.bookings.length === 0 && data.partnerships.length === 0 ? (
        <EmptyState title="No booking or partnership requests yet">
          Website submissions will appear here automatically.
        </EmptyState>
      ) : (
        <EngagementsWorkspace data={data} today={todayInJohannesburg()} />
      )}
    </div>
  );
}
