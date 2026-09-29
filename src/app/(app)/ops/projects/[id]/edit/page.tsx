import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/features/projects/components/project-form";
import { fetchProjectFormData } from "@/features/projects/fetch-project-form-options";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchProjectFormData(id);
  return { title: result.status === "ok" ? `Edit ${result.project.values.name}` : "Edit Project" };
}

export default async function EditProjectPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchProjectFormData(id);
  if (result.status === "not-found") notFound();
  if (result.status === "error")
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Edit Project"
          description="Update project and production-plan details."
        />
        <EmptyState title="This project is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  if (result.project.archived) redirect(`/ops/projects/${result.project.id}`);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Edit ${result.project.values.name}`}
        description="Update project and production-plan details."
      />
      <ProjectForm
        mode="edit"
        clients={result.clients}
        initialValue={result.project.values}
        projectId={result.project.id}
      />
    </div>
  );
}
