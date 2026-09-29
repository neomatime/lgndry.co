import type { DeliveryStatus, PaymentStatus, ProjectStatus } from "@/features/projects/types";
import { cn } from "@/lib/utils/cn";

function Badge({ children, quiet = false }: { children: React.ReactNode; quiet?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        quiet ? "border-line-strong text-ink-muted border" : "bg-line text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge quiet={["Completed", "On Hold", "Cancelled"].includes(status)}>{status}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge quiet={status === "Not Invoiced"}>{status}</Badge>;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <Badge quiet={status === "Not Ready"}>{status}</Badge>;
}
