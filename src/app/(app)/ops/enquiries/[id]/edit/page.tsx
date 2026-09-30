import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { EnquiryForm } from "@/features/enquiries/components/enquiry-form";
import { fetchEnquiryDetail } from "@/features/enquiries/fetch-enquiry-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchEnquiryDetail(id);
  return {
    title:
      result.status === "ok"
        ? `Edit ${result.enquiry.company ?? result.enquiry.fullName} Enquiry`
        : "Edit Enquiry",
  };
}

export default async function EditEnquiryPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchEnquiryDetail(id);
  if (result.status === "not-found") notFound();
  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Edit Enquiry" description="Update enquiry and contact details." />
        <EmptyState title="This enquiry is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const { enquiry } = result;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Edit ${enquiry.company ?? enquiry.fullName} Enquiry`}
        description="Update the contact information and submitted project brief."
      />
      <EnquiryForm
        enquiryId={enquiry.id}
        initialValue={{
          fullName: enquiry.fullName,
          company: enquiry.company ?? "",
          email: enquiry.email,
          phone: enquiry.phone,
          projectType: enquiry.projectType,
          location: enquiry.location,
          timeline: enquiry.timeline,
          description: enquiry.description,
          budget: enquiry.budget ?? "",
        }}
      />
    </div>
  );
}
