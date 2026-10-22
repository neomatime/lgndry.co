import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { InboxShell } from "@/features/inbox/components/inbox-shell";
import { fetchInbox } from "@/features/inbox/fetch-inbox";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  await requireOpsUser();
  const data = await fetchInbox();
  if (!data) {
    return (
      <EmptyState title="Inbox is temporarily unavailable">
        Something went wrong loading the mailbox. Try refreshing in a moment.
      </EmptyState>
    );
  }
  return <InboxShell data={data} now={new Date().toISOString()} />;
}
