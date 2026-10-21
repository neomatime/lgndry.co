"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CommercialStatusBadge } from "@/features/invoices/components/commercial-badges";
import type { InvoiceListItem } from "@/features/invoices/types";
import {
  filterInvoices,
  money,
  sortInvoices,
  type InvoiceFilter,
  type InvoiceSort,
} from "@/features/invoices/view-model";

const TABS: InvoiceFilter[] = ["All", "Open", "Overdue", "Paid", "Draft", "Void"];
const date = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});

function localDate(value: string) {
  return value ? date.format(new Date(`${value}T12:00:00+02:00`)) : "Not issued";
}

export function InvoicesTable({ rows }: { rows: InvoiceListItem[] }) {
  const [view, setView] = useState<InvoiceFilter>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<InvoiceSort>("due-date");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const counts = useMemo(
    () => new Map(TABS.map((tab) => [tab, filterInvoices(rows, tab, "").length])),
    [rows],
  );
  const visible = useMemo(
    () => sortInvoices(filterInvoices(rows, view, search), sort),
    [rows, view, search, sort],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="min-w-0">
      <section className="border-line border">
        <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Invoice status"
          >
            <h2 className="mr-4 text-lg font-medium">Invoices ({rows.length})</h2>
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={view === tab}
                onClick={() => setView(tab)}
                className={
                  view === tab
                    ? "bg-ink rounded-full px-3 py-1.5 text-xs font-medium text-white"
                    : "bg-surface-soft rounded-full px-3 py-1.5 text-xs"
                }
              >
                {tab} <span className="ml-1">{counts.get(tab)}</span>
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <label className="border-line-strong flex h-9 w-60 min-w-0 items-center gap-2 border px-3">
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Search invoices</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoices..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as InvoiceSort)}
              className="border-line-strong h-9 border bg-white px-3 text-sm"
            >
              <option value="due-date">Sort: Due Date</option>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="amount-high">Sort: Amount</option>
            </select>
          </div>
        </div>

        {visible.length ? (
          <div className="@container">
            <ul className="divide-line divide-y @3xl:hidden">
              {visible.map((row) => (
                <li key={row.id} className={selectedId === row.id ? "bg-surface-soft p-4" : "p-4"}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedId === row.id}
                      onChange={(event) => setSelectedId(event.target.checked ? row.id : null)}
                      aria-label={`Preview ${row.reference}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/ops/invoices/${row.id}`} className="font-medium underline">
                          {row.reference}
                        </Link>
                        <CommercialStatusBadge status={row.displayStatus} />
                      </div>
                      <p className="mt-2 font-medium">{row.clientName}</p>
                      <p className="text-ink-muted">{row.projectName ?? row.title}</p>
                      <div className="mt-2 flex justify-between gap-3">
                        <span>{localDate(row.dueDate)}</span>
                        <strong>{money(row.total)}</strong>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <table className="hidden w-full table-fixed border-collapse text-sm @3xl:table">
              <thead className="bg-surface-soft text-left text-xs font-medium">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Preview</span>
                  </th>
                  <th className="w-36 py-3 pr-3">Invoice ID</th>
                  <th className="py-3 pr-3">Client / Project</th>
                  <th className="w-32 py-3 pr-3">Issued</th>
                  <th className="w-32 py-3 pr-3">Due Date</th>
                  <th className="w-32 py-3 pr-3">Amount</th>
                  <th className="w-32 py-3 pr-3">Status</th>
                  <th className="hidden w-36 py-3 pr-4 @5xl:table-cell">Owner</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selectedId === row.id
                        ? "border-line bg-surface-soft border-t"
                        : "border-line hover:bg-surface-soft border-t"
                    }
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedId === row.id}
                        onChange={(event) => setSelectedId(event.target.checked ? row.id : null)}
                        aria-label={`Preview ${row.reference}`}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Link href={`/ops/invoices/${row.id}`} className="underline">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/ops/clients/${row.clientId}`}
                        className="font-medium hover:underline"
                      >
                        {row.clientName}
                      </Link>
                      <span className="text-ink-muted block truncate">
                        {row.projectName ?? row.title}
                      </span>
                    </td>
                    <td className="py-3 pr-3">{localDate(row.issueDate)}</td>
                    <td className="py-3 pr-3">{localDate(row.dueDate)}</td>
                    <td className="py-3 pr-3 font-medium">{money(row.total)}</td>
                    <td className="py-3 pr-3">
                      <CommercialStatusBadge status={row.displayStatus} />
                    </td>
                    <td className="hidden py-3 pr-4 @5xl:table-cell">{row.owner.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-muted py-14 text-center text-sm">
            No invoices match these filters.
          </p>
        )}
      </section>

      {selected ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
          <section className="border-line border p-4">
            <div className="flex justify-between gap-3">
              <h3 className="font-medium">Invoice Details</h3>
              <Link href={`/ops/invoices/${selected.id}`} className="text-sm underline">
                Open
              </Link>
            </div>
            <p className="mt-4 text-lg font-medium">{selected.clientName}</p>
            <p className="text-ink-muted text-sm">{selected.contactName}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Invoice ID</dt>
                <dd>{selected.reference}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Billing Type</dt>
                <dd>{selected.billingType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Due</dt>
                <dd>{localDate(selected.dueDate)}</dd>
              </div>
            </dl>
          </section>
          <section className="border-line border p-4">
            <h3 className="font-medium">Billing Overview</h3>
            <p className="text-ink-muted mt-3 text-sm leading-relaxed">{selected.title}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink-muted">Total</dt>
                <dd className="mt-1 text-lg font-medium">{money(selected.total)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Paid</dt>
                <dd className="mt-1 text-lg font-medium">{money(selected.paidAmount)}</dd>
              </div>
            </dl>
          </section>
          <section className="border-line border p-4">
            <h3 className="font-medium">Outstanding Snapshot</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Outstanding</dt>
                <dd className="font-medium">{money(selected.outstanding)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Payment State</dt>
                <dd>
                  <CommercialStatusBadge status={selected.displayStatus} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Owner</dt>
                <dd>{selected.owner.name}</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
