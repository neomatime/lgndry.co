import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireOpsUser();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Profile" description="Manage your Command Center account." />
      <ProfileForm user={user} />
    </div>
  );
}
