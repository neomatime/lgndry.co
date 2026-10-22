"use client";

import {
  CalendarPlus,
  FilePlus2,
  FileText,
  FolderKanban,
  FolderPlus,
  Mail,
  Search,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  OpsSearchKind,
  OpsSearchResponse,
  OpsSearchResult,
} from "@/features/ops-search/types";

const RESULT_ICONS: Record<OpsSearchKind, LucideIcon> = {
  Client: Users,
  Enquiry: Mail,
  Project: FolderKanban,
  Invoice: FileText,
  "Follow-up": CalendarPlus,
};

const QUICK_ACTIONS = [
  { label: "New client", href: "/ops/clients/new", icon: UserPlus },
  { label: "New project", href: "/ops/projects/new", icon: FolderPlus },
  { label: "New follow-up", href: "/ops/follow-ups/new", icon: CalendarPlus },
  { label: "New invoice", href: "/ops/invoices/new", icon: FilePlus2 },
] as const;

export function OpsSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpsSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(`/api/ops/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search request failed");
        const payload = (await response.json()) as OpsSearchResponse;
        setResults(payload.results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const grouped = useMemo(() => {
    const groups = new Map<OpsSearchKind, OpsSearchResult[]>();
    for (const result of results) {
      const entries = groups.get(result.kind) ?? [];
      entries.push(result);
      groups.set(result.kind, entries);
    }
    return groups;
  }, [results]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    }
    if (event.key === "Enter") {
      const result = results[activeIndex];
      if (!result) return;
      event.preventDefault();
      setOpen(false);
      router.push(result.href);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line text-ink-muted hover:border-line-strong hover:text-ink flex h-9 w-full max-w-2xl items-center gap-2 rounded-[var(--ops-radius-sm)] border bg-white px-3 text-left text-sm shadow-[inset_0_1px_2px_rgb(17_17_16_/_3%)] transition-colors duration-[var(--ops-motion-fast)]"
        aria-label="Search Command Center"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          Search enquiries, projects, clients, invoices...
        </span>
        <kbd className="bg-surface-soft hidden rounded px-1.5 py-0.5 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/20"
            aria-label="Close search"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search Command Center"
            className="border-line relative z-10 w-full max-w-2xl overflow-hidden rounded-[var(--ops-radius)] border bg-white shadow-[0_24px_70px_rgb(17_17_16_/_18%)]"
          >
            <div className="border-line flex items-center gap-3 border-b px-4">
              <Search className="text-ink-muted size-5 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  setActiveIndex(0);
                  setResults([]);
                  setFailed(false);
                  setLoading(value.trim().length >= 2);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search records or choose a quick action"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none"
                aria-label="Search records"
                aria-controls="ops-search-results"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-ink flex size-8 items-center justify-center rounded-[var(--ops-radius-sm)]"
                aria-label="Close search"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div
              id="ops-search-results"
              className="scrollbar-hidden max-h-[60vh] overflow-y-auto p-2"
            >
              {query.trim().length < 2 ? (
                <div>
                  <p className="text-ink-muted px-3 py-2 text-[11px] font-medium tracking-wider uppercase">
                    Quick actions
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className="hover:bg-surface-soft flex items-center gap-3 rounded-[var(--ops-radius-sm)] px-3 py-3 text-sm transition-colors"
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {label}
                      </Link>
                    ))}
                  </div>
                  <p className="text-ink-muted px-3 pt-4 pb-2 text-xs">
                    Enter at least two characters to search live records.
                  </p>
                </div>
              ) : loading ? (
                <div className="space-y-2 p-2" aria-live="polite">
                  <p className="sr-only">Searching</p>
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="ops-skeleton bg-surface-soft h-14 rounded" />
                  ))}
                </div>
              ) : failed ? (
                <p className="text-ink-muted px-4 py-10 text-center text-sm" role="alert">
                  Search is temporarily unavailable. Try again in a moment.
                </p>
              ) : results.length ? (
                Array.from(grouped.entries()).map(([kind, entries]) => (
                  <div key={kind}>
                    <p className="text-ink-muted px-3 pt-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
                      {kind}
                    </p>
                    {entries.map((result) => {
                      const index = results.indexOf(result);
                      const Icon = RESULT_ICONS[result.kind];
                      return (
                        <Link
                          key={`${result.kind}-${result.id}`}
                          href={result.href}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 rounded-[var(--ops-radius-sm)] px-3 py-2.5 text-sm ${
                            index === activeIndex ? "bg-surface-soft" : "hover:bg-surface-soft"
                          }`}
                        >
                          <span className="bg-surface-soft flex size-9 shrink-0 items-center justify-center rounded-full">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{result.title}</span>
                            <span className="text-ink-muted block truncate text-xs">
                              {result.subtitle}
                            </span>
                          </span>
                          <span className="bg-surface-soft shrink-0 rounded-full px-2 py-1 text-[11px]">
                            {result.status}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="text-ink-muted px-4 py-10 text-center text-sm" aria-live="polite">
                  No matching records found.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
