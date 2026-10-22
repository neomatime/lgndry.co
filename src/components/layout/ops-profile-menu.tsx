"use client";

import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OpsUser } from "@/lib/auth/server";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : name.slice(0, 2);
  return letters.toUpperCase();
}

export function OpsProfileMenu({ user }: { user: OpsUser }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-surface-soft flex items-center gap-2 rounded-[var(--ops-radius-sm)] p-1.5 text-left transition-colors"
      >
        <span
          aria-hidden="true"
          className="bg-ink text-surface flex size-8 items-center justify-center rounded-full text-xs font-medium"
        >
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 leading-tight md:block">
          <span className="block max-w-32 truncate text-sm font-medium">{user.name}</span>
          <span className="text-ink-muted block text-xs">Admin</span>
        </span>
        <ChevronDown className="text-ink-muted hidden size-4 sm:block" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="border-line bg-surface absolute top-[calc(100%+0.5rem)] right-0 z-50 w-48 rounded-[var(--ops-radius)] border p-1.5 shadow-[var(--ops-shadow-raised)]"
        >
          <Link
            href="/ops/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="hover:bg-surface-soft flex items-center gap-3 rounded-[var(--ops-radius-sm)] px-3 py-2 text-sm"
          >
            <UserRound className="size-4" aria-hidden="true" /> Profile
          </Link>
          <Link
            href="/ops/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="hover:bg-surface-soft flex items-center gap-3 rounded-[var(--ops-radius-sm)] px-3 py-2 text-sm"
          >
            <Settings className="size-4" aria-hidden="true" /> Settings
          </Link>
          <div className="border-line my-1 border-t" />
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="hover:bg-surface-soft flex w-full items-center gap-3 rounded-[var(--ops-radius-sm)] px-3 py-2 text-left text-sm"
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
