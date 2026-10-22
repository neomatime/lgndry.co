import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { fetchOpsSettings } from "@/features/settings/fetch-ops-settings";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireOpsUser();
  const result = await fetchOpsSettings();

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Manage workspace details and commercial defaults."
        actions={
          <Link
            href="/ops/settings/team"
            className="border-line-strong hover:bg-surface-soft inline-flex h-10 items-center gap-2 rounded-[var(--ops-radius-sm)] border bg-white px-4 text-sm font-medium"
          >
            <Users className="size-4" aria-hidden="true" /> Manage Team
          </Link>
        }
      />
      {result.status === "error" ? (
        <EmptyState title="Settings are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      ) : (
        <SettingsForm
          key={result.settings.id + ":" + result.settings.version}
          initialSettings={result.settings}
        />
      )}
    </div>
  );
}
