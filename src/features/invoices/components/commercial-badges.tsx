import { cn } from "@/lib/utils/cn";

export function CommercialStatusBadge({ status }: { status: string }) {
  const strong = ["Draft", "Overdue"].includes(status);
  const quiet = ["Paid", "Approved", "Void", "Superseded", "Expired"].includes(status);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        strong && "bg-ink text-white",
        !strong && !quiet && "bg-line text-ink",
        quiet && "border-line-strong text-ink-muted border",
      )}
    >
      {status}
    </span>
  );
}
