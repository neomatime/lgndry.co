"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ops/status-badge";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/features/enquiries/types";
import {
  countByStatus,
  filterEnquiries,
  sortEnquiries,
  type EnquiryListItem,
} from "@/features/enquiries/list-view-model";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" });

export function EnquiriesTable({ rows }: { rows: EnquiryListItem[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<EnquiryStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [checkedId, setCheckedId] = useState<string | null>(null);

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const visible = useMemo(
    () => sortEnquiries(filterEnquiries(rows, { status, search }), sort),
    [rows, status, search, sort],
  );
  const checked = visible.find((row) => row.id === checkedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-line flex items-center justify-between border-b">
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={status === "All"}
            onClick={() => setStatus("All")}
            className={
              status === "All"
                ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
            }
          >
            All ({rows.length})
          </button>
          {ENQUIRY_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={
                status === value
                  ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                  : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
              }
            >
              {value} ({counts[value]})
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="search"
            placeholder="Search enquiries..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-line-strong h-9 border px-3 text-sm"
          />
          <select
            aria-label="Sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as "newest" | "oldest")}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-ink-muted py-14 text-center text-sm">No enquiries match this filter.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-line border-b text-left">
              <th className="w-8 py-2" />
              <th className="py-2 pr-4">Client / Contact</th>
              <th className="py-2 pr-4">Project Type</th>
              <th className="py-2 pr-4">Submitted</th>
              <th className="py-2 pr-4">Attachments</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-line hover:bg-surface-soft border-b align-top">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={checkedId === row.id}
                    onChange={(event) => setCheckedId(event.target.checked ? row.id : null)}
                    aria-label={`Preview ${row.fullName}`}
                  />
                </td>
                <td
                  className="cursor-pointer py-2 pr-4"
                  onClick={() => router.push(`/ops/enquiries/${row.id}`)}
                >
                  <p className="font-medium">{row.fullName}</p>
                  {row.company ? <p className="text-ink-muted">{row.company}</p> : null}
                </td>
                <td className="py-2 pr-4">{row.projectType}</td>
                <td className="py-2 pr-4">{dateFormatter.format(new Date(row.createdAt))}</td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {row.attachmentCount}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {checked ? (
        <div className="border-line grid gap-6 border p-6 md:grid-cols-3">
          <div>
            <h3 className="font-medium">Enquiry Details</h3>
            <dl className="text-ink-muted mt-2 space-y-1 text-sm">
              <div>
                <dt className="inline">Client: </dt>
                <dd className="text-ink inline">{checked.company ?? checked.fullName}</dd>
              </div>
              <div>
                <dt className="inline">Contact: </dt>
                <dd className="text-ink inline">{checked.fullName}</dd>
              </div>
              <div>
                <dt className="inline">Status: </dt>
                <dd className="inline">
                  <StatusBadge status={checked.status} />
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="font-medium">Project Brief</h3>
            <p className="text-ink-muted mt-2 text-sm">{checked.description}</p>
          </div>
          <div>
            <h3 className="font-medium">Attachments ({checked.attachmentCount})</h3>
            <p className="text-ink-muted mt-2 text-sm">
              {checked.attachmentCount === 0
                ? "No attachments."
                : "Open the full record to view attachments."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
