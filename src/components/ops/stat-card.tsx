import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border-line flex items-center gap-4 border p-5">
      <span className="bg-surface-soft flex size-11 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-ink-muted text-sm">{label}</p>
        <div className="text-2xl font-medium">{value}</div>
      </div>
    </div>
  );
}
