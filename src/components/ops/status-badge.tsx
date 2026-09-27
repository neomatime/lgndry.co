import { cn } from "@/lib/utils/cn";
import type { EnquiryStatus } from "@/features/enquiries/types";

const TERMINAL: ReadonlySet<EnquiryStatus> = new Set(["Completed", "Closed"]);

/**
 * The design system is intentionally monochrome (ink/ink-muted/surface/line)
 * -- no colored tokens exist anywhere in this codebase, so status is
 * distinguished by weight, not hue: New (unactioned) gets the same filled
 * treatment as a primary Button; every in-progress status gets a neutral
 * filled pill; the two terminal statuses get a quieter outline.
 */
export function StatusBadge({ status }: { status: EnquiryStatus }) {
  const classes =
    status === "New"
      ? "bg-ink text-white"
      : TERMINAL.has(status)
        ? "border-line-strong text-ink-muted border"
        : "bg-line text-ink";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        classes,
      )}
    >
      {status}
    </span>
  );
}
