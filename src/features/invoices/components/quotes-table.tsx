"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CommercialStatusBadge } from "@/features/invoices/components/commercial-badges";
import type { QuoteListItem } from "@/features/invoices/types";
import { filterQuotes, money } from "@/features/invoices/view-model";

export function QuotesTable({ rows }: { rows: QuoteListItem[] }) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => filterQuotes(rows, search), [rows, search]);
  return (
    <section className="border-line border">
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-lg font-medium">Quotes ({rows.length})</h2>
        <label className="border-line-strong flex h-9 w-64 items-center gap-2 border px-3">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">Search quotes</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quotes..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>
      <div className="@container">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-surface-soft text-left text-xs">
            <tr>
              <th className="w-36 px-4 py-3">Quote ID</th>
              <th className="py-3 pr-3">Client / Title</th>
              <th className="hidden w-32 py-3 pr-3 @3xl:table-cell">Valid Until</th>
              <th className="w-32 py-3 pr-3">Amount</th>
              <th className="w-28 py-3 pr-3">Status</th>
              <th className="hidden w-36 py-3 pr-4 @4xl:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-line hover:bg-surface-soft border-t">
                <td className="px-4 py-3">
                  <Link href={`/ops/invoices/quotes/${row.id}`} className="underline">
                    {row.reference} / R{row.revision}
                  </Link>
                </td>
                <td className="py-3 pr-3">
                  <Link
                    href={`/ops/clients/${row.clientId}`}
                    className="font-medium hover:underline"
                  >
                    {row.clientName}
                  </Link>
                  <span className="text-ink-muted block truncate">{row.title}</span>
                </td>
                <td className="hidden py-3 pr-3 @3xl:table-cell">{row.validUntil || "Draft"}</td>
                <td className="py-3 pr-3 font-medium">{money(row.total)}</td>
                <td className="py-3 pr-3">
                  <CommercialStatusBadge status={row.status} />
                </td>
                <td className="hidden py-3 pr-4 @4xl:table-cell">{row.owner.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? (
        <p className="text-ink-muted py-14 text-center text-sm">No quotes match this search.</p>
      ) : null}
    </section>
  );
}
