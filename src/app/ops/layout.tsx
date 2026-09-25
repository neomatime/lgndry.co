import type { Metadata } from "next";
import { OpsSidebar } from "@/components/layout/ops-sidebar";
import { OpsTopbar } from "@/components/layout/ops-topbar";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: { default: "Command Center", template: "%s · Command Center" },
  robots: { index: false, follow: false },
};

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOpsUser();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <OpsSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OpsTopbar user={user} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
