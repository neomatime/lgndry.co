import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectDetailView } from "@/features/projects/components/project-detail";
import { fetchProjectDetail } from "@/features/projects/fetch-project-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchProjectDetail(id);
  return { title: result.status === "ok" ? `${result.project.name} Project` : "Project" };
}

export default async function ProjectDetailPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchProjectDetail(id);

  if (result.status === "not-found") notFound();

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Project" description="Manage production work and delivery." />
        <EmptyState title="This project is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  return <ProjectDetailView project={result.project} />;
}
