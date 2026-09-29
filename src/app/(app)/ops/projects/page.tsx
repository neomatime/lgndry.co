import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, FolderKanban, Plus, Send, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { ProjectsBoard } from "@/features/projects/components/projects-board";
import { fetchProjects } from "@/features/projects/fetch-projects";
import { summarizeProjects } from "@/features/projects/list-view-model";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Projects" };

const newProjectAction = (
  <Link
    href="/ops/projects/new"
    className="border-ink bg-ink inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium text-white transition-colors hover:bg-black"
  >
    <Plus className="size-4" aria-hidden="true" />
    New Project
  </Link>
);

export default async function ProjectsPage() {
  await requireOpsUser();
  const rows = await fetchProjects();

  if (rows === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Projects"
          description="Track active work, production stages, deliverables and next actions."
          actions={newProjectAction}
        />
        <EmptyState title="Projects are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const stats = summarizeProjects(rows);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Projects"
        description="Track active work, production stages, deliverables and next actions."
        actions={newProjectAction}
      />
      {rows.length === 0 ? (
        <EmptyState title="No projects yet">
          Create the first project or convert a qualified enquiry to begin production planning.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={FolderKanban} label="Active Projects" value={stats.active} />
            <StatCard icon={Clapperboard} label="In Production" value={stats.inProduction} />
            <StatCard icon={UsersRound} label="Awaiting Approval" value={stats.awaitingApproval} />
            <StatCard icon={Send} label="Ready for Delivery" value={stats.readyForDelivery} />
          </div>
          <ProjectsBoard rows={rows} />
        </>
      )}
    </div>
  );
}
