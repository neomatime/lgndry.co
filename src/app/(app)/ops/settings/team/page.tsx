import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TeamManager } from "@/features/team/components/team-manager";
import { fetchOpsTeam } from "@/features/team/fetch-team";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requireOpsUser();
  const result = await fetchOpsTeam();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader
        title="Team"
        description="Manage access to the LGNDRY.Co Command Center."
        actions={
          <Link
            href="/ops/settings"
            className="border-line-strong hover:bg-surface-soft inline-flex h-10 items-center gap-2 rounded-[var(--ops-radius-sm)] border bg-white px-4 text-sm font-medium"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to Settings
          </Link>
        }
      />
      {result.status === "error" ? (
        <EmptyState title="Team members are temporarily unavailable">
          Something went wrong loading the team. Try refreshing in a moment.
        </EmptyState>
      ) : (
        <TeamManager members={result.members} />
      )}
    </div>
  );
}
