import type { Metadata } from "next";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: { default: "Command Center", template: "%s · Command Center" },
  robots: { index: false, follow: false },
};

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOpsUser();

  return <OpsShell user={user}>{children}</OpsShell>;
}
