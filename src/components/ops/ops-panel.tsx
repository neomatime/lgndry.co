import { cn } from "@/lib/utils/cn";

export function OpsPanel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "border-line rounded-[var(--ops-radius)] border bg-white shadow-[var(--ops-shadow-resting)]",
        className,
      )}
      {...props}
    />
  );
}

export function OpsPanelHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex min-h-11 items-center justify-between gap-3 px-4 py-2.5", className)}
      {...props}
    />
  );
}
