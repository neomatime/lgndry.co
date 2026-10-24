import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { InboxShell } from "@/features/inbox/components/inbox-shell";
import { buildEmailSignature } from "@/features/inbox/email-formatting";
import { fetchInbox } from "@/features/inbox/fetch-inbox";
import { fetchOpsSettings } from "@/features/settings/fetch-ops-settings";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  await requireOpsUser();
  const [data, settingsResult] = await Promise.all([fetchInbox(), fetchOpsSettings()]);
  if (!data) {
    return (
      <EmptyState title="Inbox is temporarily unavailable">
        Something went wrong loading the mailbox. Try refreshing in a moment.
      </EmptyState>
    );
  }
  const settings = settingsResult.status === "ok" ? settingsResult.settings : null;
  const websiteUrl = settings?.websiteUrl || "https://www.lgndry-co.co.za";
  const signature = buildEmailSignature({
    bannerUrl: new URL("/ops-email-banner.png", websiteUrl).toString(),
  });
  return <InboxShell data={data} now={new Date().toISOString()} signature={signature} />;
}
