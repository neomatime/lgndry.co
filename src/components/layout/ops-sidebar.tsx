"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Wordmark } from "@/components/branding/wordmark";
import { OpsNav } from "@/components/layout/ops-nav";
import { cn } from "@/lib/utils/cn";

export function OpsSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "bg-surface-soft border-line flex flex-col gap-4 border-b p-4 transition-[width,padding] duration-[var(--ops-motion-standard)] ease-[var(--ops-ease)] lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:gap-8 lg:border-r lg:border-b-0",
        collapsed ? "lg:w-[4.75rem] lg:px-3 lg:py-5" : "lg:w-64 lg:p-5",
      )}
    >
      <div className="flex min-h-11 items-start justify-between gap-3">
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <Wordmark />
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "hidden size-9 items-center justify-center font-serif text-2xl font-medium lg:flex",
            !collapsed && "lg:hidden",
          )}
        >
          L.
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="border-line-strong hover:bg-line/40 hidden size-9 shrink-0 items-center justify-center rounded-[var(--ops-radius-sm)] border bg-white transition-[background-color,box-shadow] duration-[var(--ops-motion-fast)] lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ToggleIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
      <OpsNav collapsed={collapsed} />
      <p
        className={cn(
          "text-ink-muted mt-auto hidden text-[0.6rem] leading-relaxed tracking-[0.2em] uppercase lg:block",
          collapsed && "lg:hidden",
        )}
      >
        Extraordinary stories.
        <br />
        Real-world impact.
      </p>
    </aside>
  );
}
