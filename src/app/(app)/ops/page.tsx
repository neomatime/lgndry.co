import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function CommandCenterPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="OPS Command Center"
        description="Attention-led internal operations for enquiries, projects, follow-ups and payment status."
      />
      <EmptyState title="The Command Center is built last">
        It summarises the Enquiries, Projects, Follow-ups and Invoices modules, so it comes after
        them. Modules appear in the sidebar as they are built.
      </EmptyState>
    </div>
  );
}
