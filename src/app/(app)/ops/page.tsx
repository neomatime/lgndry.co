import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { fetchDashboardData } from "@/features/dashboard/fetch-dashboard";
import { buildDashboardViewModel, dashboardGreeting } from "@/features/dashboard/view-model";
import { johannesburgDate } from "@/features/follow-ups/list-view-model";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Command Center" };

export default async function CommandCenterPage() {
  const user = await requireOpsUser();
  const now = new Date();
  const data = await fetchDashboardData(johannesburgDate(now), now);

  if (data) {
    return (
      <DashboardOverview
        dashboard={buildDashboardViewModel(data, now)}
        greeting={dashboardGreeting(user.name, now)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="OPS Command Center"
        description="Attention-led internal operations for enquiries, projects, follow-ups and payment status."
      />
      <EmptyState title="The Command Center is temporarily unavailable">
        Something went wrong loading the operational overview. Try refreshing in a moment.
      </EmptyState>
    </div>
  );
}
