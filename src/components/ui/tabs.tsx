"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export type TabItem = { id: string; label: string; content: React.ReactNode };

export function Tabs({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div>
      <div role="tablist" className="border-line flex gap-1 overflow-x-auto border-b">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active?.id}
            onClick={() => setActiveId(item.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              item.id === active?.id
                ? "border-ink text-ink"
                : "text-ink-muted hover:text-ink border-transparent",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-6">
        {active?.content}
      </div>
    </div>
  );
}
