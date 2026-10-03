"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PriorityBadge,
  ScheduleStateBadge,
} from "@/features/follow-ups/components/follow-up-badges";
import { FollowUpPreview, relatedHref } from "@/features/follow-ups/components/follow-up-preview";
import { formatDueLabel } from "@/features/follow-ups/due-label";
import {
  filterFollowUps,
  sortFollowUps,
  type FollowUpFilters,
  type FollowUpSort,
  type FollowUpView,
} from "@/features/follow-ups/list-view-model";
import {
  FOLLOW_UP_CONTACT_METHODS,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_TYPES,
  type FollowUpListItem,
} from "@/features/follow-ups/types";

const TABS: { view: FollowUpView; label: string }[] = [
  { view: "All", label: "All" },
  { view: "Today", label: "Due Today" },
  { view: "Overdue", label: "Overdue" },
  { view: "Upcoming", label: "Upcoming" },
  { view: "Completed", label: "Completed" },
  { view: "Cancelled", label: "Cancelled" },
];

const SORTS: { value: FollowUpSort; label: string }[] = [
  { value: "due-soonest", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-line-strong bg-surface h-9 w-full min-w-0 border px-2 text-sm sm:w-auto sm:max-w-48"
      >
        {children}
      </select>
    </label>
  );
}

function RelatedItem({ related }: { related: FollowUpListItem["related"] }) {
  if (!related) return <span className="text-ink-muted block">No related item</span>;
  return (
    <span className="text-ink-muted block break-words">
      {related.kind}:{" "}
      <Link href={relatedHref(related)} className="hover:text-ink underline">
        {related.label}
      </Link>
    </span>
  );
}

/**
 * `rows` arrive with scheduling states already evaluated by the server against `now`
 * (an ISO string chosen once per request). Nothing in here reads the browser clock, so
 * the server render and hydration always agree; a tab left open overnight keeps showing
 * the day it was loaded until the page is refreshed or navigated.
 */
export function FollowUpsTable({
  rows,
  now,
  currentUserId,
}: {
  rows: FollowUpListItem[];
  now: string;
  currentUserId: string;
}) {
  const [view, setView] = useState<FollowUpView>("All");
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [ownerScope, setOwnerScope] = useState<"all" | "mine">("all");
  const [sort, setSort] = useState<FollowUpSort>("due-soonest");
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const nowDate = useMemo(() => new Date(now), [now]);

  const clients = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.clientId, row.clientName])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [rows],
  );
  const counts = useMemo(
    () =>
      new Map(
        TABS.map(({ view: tab }) => [tab, filterFollowUps(rows, { view: tab, search: "" }).length]),
      ),
    [rows],
  );
  const filters = useMemo<FollowUpFilters>(
    () => ({
      view,
      search,
      clientId: clientId || undefined,
      type: type ? (type as FollowUpFilters["type"]) : undefined,
      priority: priority ? (priority as FollowUpFilters["priority"]) : undefined,
      contactMethod: contactMethod
        ? (contactMethod as FollowUpFilters["contactMethod"])
        : undefined,
      ownerId: ownerScope === "mine" ? currentUserId : undefined,
    }),
    [view, search, clientId, type, priority, contactMethod, ownerScope, currentUserId],
  );
  const visible = useMemo(
    () => sortFollowUps(filterFollowUps(rows, filters), sort),
    [rows, filters, sort],
  );
  const checked = visible.find((row) => row.id === checkedId) ?? null;

  const select = (row: FollowUpListItem, isChecked: boolean) =>
    setCheckedId(isChecked ? row.id : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-line flex flex-col gap-3 border-b">
        {/* The tabs wrap instead of scrolling: six short labels never need a scrollbar. */}
        <div role="tablist" aria-label="Follow-up views" className="flex flex-wrap gap-x-1">
          {TABS.map(({ view: tab, label }) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={view === tab}
              onClick={() => setView(tab)}
              className={
                view === tab
                  ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                  : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
              }
            >
              {label} ({counts.get(tab)})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pb-3 sm:flex sm:flex-wrap sm:items-center">
          <label className="border-line-strong col-span-2 flex h-9 min-w-0 items-center gap-2 border px-3 sm:w-64">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Search follow-ups</span>
            <input
              type="search"
              placeholder="Search follow-ups..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <FilterSelect label="Client" value={clientId} onChange={setClientId}>
            <option value="">All clients</option>
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Type" value={type} onChange={setType}>
            <option value="">All types</option>
            {FOLLOW_UP_TYPES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Priority" value={priority} onChange={setPriority}>
            <option value="">All priorities</option>
            {FOLLOW_UP_PRIORITIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Contact method" value={contactMethod} onChange={setContactMethod}>
            <option value="">All methods</option>
            {FOLLOW_UP_CONTACT_METHODS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Owner scope"
            value={ownerScope}
            onChange={(value) => setOwnerScope(value === "mine" ? "mine" : "all")}
          >
            <option value="all">Owner: All</option>
            <option value="mine">Owner: Mine</option>
          </FilterSelect>
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={(value) => setSort(value as FollowUpSort)}
          >
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                Sort: {label}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      <p aria-live="polite" className="text-ink-muted text-sm">
        Showing {visible.length} of {rows.length} follow-ups
      </p>

      {visible.length === 0 ? (
        <p className="text-ink-muted py-14 text-center text-sm">
          No follow-ups match these filters.
        </p>
      ) : (
        // Container queries rather than viewport breakpoints, because the sidebar changes how
        // much room the content really has. The table never scrolls sideways: it is
        // `table-fixed` at full width, secondary columns drop out as the container narrows,
        // and below @2xl it is replaced by a stacked list.
        <div className="@container">
          <ul
            aria-label="Follow-ups"
            className="divide-line border-line divide-y border-y @2xl:hidden"
          >
            {visible.map((row) => (
              <li key={row.id} className="flex items-start gap-3 py-4">
                <input
                  type="checkbox"
                  checked={checkedId === row.id}
                  onChange={(event) => select(row, event.target.checked)}
                  aria-label={`Preview ${row.reference}`}
                  className="mt-1 shrink-0"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ops/follow-ups/${row.id}`}
                      className="text-ink-muted hover:text-ink underline"
                    >
                      {row.reference}
                    </Link>
                    <ScheduleStateBadge state={row.scheduleState} />
                    <PriorityBadge priority={row.priority} />
                  </div>
                  <p className="mt-2 font-medium break-words">
                    <Link href={`/ops/follow-ups/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  </p>
                  <p className="mt-1 break-words">
                    <Link href={`/ops/clients/${row.clientId}`} className="hover:underline">
                      {row.clientName}
                    </Link>
                  </p>
                  <RelatedItem related={row.related} />
                  <p className="text-ink-muted mt-2">
                    {row.displayType} · {formatDueLabel(row.dueDate, row.dueTime, nowDate)}
                  </p>
                  <p className="text-ink-muted">Owner: {row.owner.name || "Unassigned"}</p>
                </div>
              </li>
            ))}
          </ul>

          <table className="hidden w-full table-fixed border-collapse text-sm @2xl:table">
            <thead>
              <tr className="border-line border-b text-left">
                <th className="w-10 py-2">
                  <span className="sr-only">Preview</span>
                </th>
                <th className="hidden w-24 py-2 pr-4 @4xl:table-cell">Reference</th>
                <th className="py-2 pr-4">Client / Related</th>
                <th className="hidden w-32 py-2 pr-4 @5xl:table-cell">Type</th>
                <th className="w-32 py-2 pr-4">Due</th>
                <th className="hidden w-24 py-2 pr-4 @4xl:table-cell">Priority</th>
                <th className="w-28 py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Next Action</th>
                <th className="hidden w-28 py-2 @5xl:table-cell">Owner</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={
                    checkedId === row.id
                      ? "border-line bg-surface-soft border-b align-top"
                      : "border-line hover:bg-surface-soft border-b align-top"
                  }
                >
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={checkedId === row.id}
                      onChange={(event) => select(row, event.target.checked)}
                      aria-label={`Preview ${row.reference}`}
                    />
                  </td>
                  <td className="hidden py-3 pr-4 whitespace-nowrap @4xl:table-cell">
                    <Link
                      href={`/ops/follow-ups/${row.id}`}
                      className="text-ink-muted hover:text-ink underline"
                    >
                      {row.reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 break-words">
                    <Link
                      href={`/ops/clients/${row.clientId}`}
                      className="block font-medium hover:underline"
                    >
                      {row.clientName}
                    </Link>
                    <RelatedItem related={row.related} />
                  </td>
                  <td className="hidden py-3 pr-4 break-words @5xl:table-cell">
                    {row.displayType}
                  </td>
                  <td className="py-3 pr-4">{formatDueLabel(row.dueDate, row.dueTime, nowDate)}</td>
                  <td className="hidden py-3 pr-4 @4xl:table-cell">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="py-3 pr-4">
                    <ScheduleStateBadge state={row.scheduleState} />
                  </td>
                  <td className="py-3 pr-4 break-words">
                    <Link href={`/ops/follow-ups/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="hidden py-3 break-words @5xl:table-cell">
                    {row.owner.name || "Unassigned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {checked ? <FollowUpPreview followUp={checked} /> : null}
    </div>
  );
}
