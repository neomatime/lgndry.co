import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/features/projects/components/project-form";
import { fetchProjectConversion } from "@/features/projects/fetch-project-conversion";
import { fetchProjectFormOptions } from "@/features/projects/fetch-project-form-options";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New Project" };
type Props = { searchParams: Promise<{ enquiry?: string | string[] }> };

export default async function NewProjectPage({ searchParams }: Props) {
  await requireOpsUser();
  const query = await searchParams;
  const enquiryId = typeof query.enquiry === "string" ? query.enquiry : undefined;

  if (enquiryId) {
    const result = await fetchProjectConversion(enquiryId);
    if (result.status === "not-found") notFound();
    if (result.status === "error") {
      return (
        <div className="flex flex-col gap-8">
          <PageHeader title="New Project" description="Create a project from an enquiry." />
          <EmptyState title="This enquiry is temporarily unavailable">
            Something went wrong loading the conversion details. Try refreshing in a moment.
          </EmptyState>
        </div>
      );
    }
    if (result.status === "conflict") {
      return (
        <div className="flex flex-col gap-8">
          <PageHeader
            title="Project already created"
            description="This enquiry is already linked to a project."
          />
          <EmptyState title="This enquiry already has a project">
            <Link href={`/ops/projects/${result.projectId}`} className="font-medium underline">
              Open the existing project
            </Link>
          </EmptyState>
        </div>
      );
    }
    if (result.status === "invalid") {
      return (
        <div className="flex flex-col gap-8">
          <PageHeader
            title="Project cannot be created"
            description="This enquiry is not eligible for conversion."
          />
          <EmptyState title="Conversion unavailable">{result.message}</EmptyState>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Create Project from Enquiry"
          description="Review the mapped details, complete the production plan, and confirm the conversion."
        />
        <ProjectForm
          mode="conversion"
          clients={[result.client]}
          initialValue={result.values}
          enquiryId={result.enquiryId}
          sourceTimeline={result.sourceTimeline}
          sourceBudget={result.sourceBudget}
        />
      </div>
    );
  }

  const clients = await fetchProjectFormOptions();
  if (!clients) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="New Project" description="Create a project and production plan." />
        <EmptyState title="Project form is temporarily unavailable">
          Something went wrong loading client options. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="New Project" description="Create a project and production plan." />
      <ProjectForm mode="create" clients={clients} />
    </div>
  );
}
