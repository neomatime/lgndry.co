"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type TabItem = { id: string; label: string; content: React.ReactNode };

export function Tabs({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);
  const active = items.find((item) => item.id === activeId) ?? items[0];
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (index: number) => {
    const item = items[index];
    if (!item) return;
    setActiveId(item.id);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    activate(next);
  };

  return (
    <div>
      <div
        role="tablist"
        className="border-line scrollbar-hidden flex gap-1 overflow-x-auto border-b"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`${instanceId}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={item.id === active?.id}
            aria-controls={`${instanceId}-panel-${item.id}`}
            tabIndex={item.id === active?.id ? 0 : -1}
            onClick={() => setActiveId(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
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
      <div
        id={`${instanceId}-panel-${active?.id}`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-tab-${active?.id}`}
        className="pt-6"
      >
        {active?.content}
      </div>
    </div>
  );
}
