import { cn } from "@/lib/utils/cn";
import type { AccountTier, ClientStatus } from "@/features/clients/types";

export function ClientStatusBadge({
  status,
  archived = false,
}: {
  status: ClientStatus;
  archived?: boolean;
}) {
  const classes = archived
    ? "border-line-strong text-ink-muted border"
    : status === "Lead"
      ? "bg-ink text-white"
      : status === "Active"
        ? "bg-line text-ink"
        : status === "At Risk"
          ? "border-ink text-ink border font-semibold"
          : "border-line-strong text-ink-muted border";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        classes,
      )}
    >
      {archived ? "Archived" : status}
    </span>
  );
}

export function AccountTierBadge({ tier }: { tier: AccountTier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs whitespace-nowrap",
        tier === "Key Account"
          ? "bg-ink font-medium text-white"
          : "border-line text-ink-muted border",
      )}
    >
      {tier}
    </span>
  );
}
