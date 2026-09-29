import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/features/clients/components/client-form";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New Client" };

export default async function NewClientPage() {
  await requireOpsUser();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="New Client"
        description="Create a client profile and add the people connected to the relationship."
      />
      <ClientForm mode="create" />
    </div>
  );
}
