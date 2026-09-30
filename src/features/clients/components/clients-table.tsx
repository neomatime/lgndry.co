"use client";

import { Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ops/status-badge";
import { AccountTierBadge, ClientStatusBadge } from "@/features/clients/components/client-badges";
import {
  filterClients,
  sortClients,
  type ClientListItem,
  type ClientSort,
} from "@/features/clients/list-view-model";
import { CLIENT_FILTERS, type ClientFilter } from "@/features/clients/types";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

function countForFilter(rows: ClientListItem[], filter: ClientFilter) {
  return filterClients(rows, { filter, search: "" }).length;
}

export function ClientsTable({ rows }: { rows: ClientListItem[] }) {
  const [filter, setFilter] = useState<ClientFilter>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ClientSort>("newest");
  const [checkedId, setCheckedId] = useState<string | null>(null);

  const counts = useMemo(
    () => new Map(CLIENT_FILTERS.map((value) => [value, countForFilter(rows, value)])),
    [rows],
  );
  const visible = useMemo(
    () => sortClients(filterClients(rows, { filter, search }), sort),
    [rows, filter, search, sort],
  );
  const checked = rows.find((row) => row.id === checkedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-line flex flex-col gap-3 border-b lg:flex-row lg:items-end lg:justify-between">
        <div role="tablist" aria-label="Client filters" className="flex gap-1 overflow-x-auto">
          {CLIENT_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={
                filter === value
                  ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                  : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
              }
            >
              {value} ({counts.get(value)})
            </button>
          ))}
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2 pb-3 lg:pb-2">
          <input
            type="search"
            placeholder="Search clients..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-line-strong h-9 min-w-0 flex-1 border px-3 text-sm sm:w-56"
          />
          <select
            aria-label="Sort clients"
            value={sort}
            onChange={(event) => setSort(event.target.value as ClientSort)}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-ink-muted py-14 text-center text-sm">No clients match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-line border-b text-left">
                <th className="w-10 py-2" />
                <th className="py-2 pr-4">Client / Primary Contact</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Industry</th>
                <th className="py-2 pr-4">Open Enquiries</th>
                <th className="py-2 pr-4">Last Activity</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Tier</th>
                <th className="w-20 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-line hover:bg-surface-soft border-b align-middle"
                >
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={checkedId === row.id}
                      onChange={(event) => setCheckedId(event.target.checked ? row.id : null)}
                      aria-label={`Preview ${row.name}`}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/ops/clients/${row.id}`} className="block">
                      <span className="font-medium hover:underline">{row.name}</span>
                      {row.primaryContact ? (
                        <span className="text-ink-muted block">{row.primaryContact.fullName}</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{row.type}</td>
                  <td className="py-3 pr-4">{row.industry ?? "—"}</td>
                  <td className="py-3 pr-4">{row.openEnquiryCount}</td>
                  <td className="py-3 pr-4">
                    {dateFormatter.format(new Date(row.lastActivityAt))}
                  </td>
                  <td className="py-3 pr-4">
                    <ClientStatusBadge status={row.status} archived={row.archived} />
                  </td>
                  <td className="py-3 pr-4">
                    <AccountTierBadge tier={row.accountTier} />
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Link
                        href={`/ops/clients/${row.id}`}
                        aria-label={`View ${row.name}`}
                        title={`View ${row.name}`}
                        className="hover:bg-line inline-flex size-8 items-center justify-center"
                      >
                        <Eye className="size-4" aria-hidden="true" />
                      </Link>
                      {!row.archived ? (
                        <Link
                          href={`/ops/clients/${row.id}/edit`}
                          aria-label={`Edit ${row.name}`}
                          title={`Edit ${row.name}`}
                          className="hover:bg-line inline-flex size-8 items-center justify-center"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {checked ? (
        <section aria-label={`${checked.name} preview`} className="border-line border p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-medium">{checked.name}</p>
              <p className="text-ink-muted mt-1 text-sm">
                {[checked.industry, checked.region].filter(Boolean).join(" · ") || checked.type}
              </p>
            </div>
            <Link href={`/ops/clients/${checked.id}`} className="text-sm font-medium underline">
              View Client
            </Link>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {checked.accountOverview ? (
              <div>
                <h3 className="text-sm font-medium">Account Overview</h3>
                <p className="text-ink-muted mt-2 text-sm">{checked.accountOverview}</p>
                <p className="text-ink-muted mt-3 text-xs">
                  Client since {dateFormatter.format(new Date(`${checked.clientSince}T12:00:00Z`))}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-medium">Client Profile</h3>
                <p className="text-ink-muted mt-2 text-sm">
                  Client since {dateFormatter.format(new Date(`${checked.clientSince}T12:00:00Z`))}
                </p>
              </div>
            )}
            {checked.contacts.length ? (
              <div>
                <h3 className="text-sm font-medium">Contacts ({checked.contacts.length})</h3>
                <ul className="text-ink-muted mt-2 space-y-2 text-sm">
                  {checked.contacts.slice(0, 4).map((contact) => (
                    <li key={contact.id}>
                      <span className="text-ink block">
                        {contact.fullName}
                        {contact.isPrimary ? " · Primary" : ""}
                      </span>
                      <span>{contact.email}</span>
                    </li>
                  ))}
                </ul>
                {checked.contacts.length > 4 ? (
                  <p className="text-ink-muted mt-2 text-xs">
                    +{checked.contacts.length - 4} more contacts
                  </p>
                ) : null}
              </div>
            ) : null}
            <div>
              <h3 className="text-sm font-medium">Relationship</h3>
              <dl className="text-ink-muted mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>Open enquiries</dt>
                  <dd className="text-ink">{checked.openEnquiryCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Last activity</dt>
                  <dd className="text-ink">
                    {dateFormatter.format(new Date(checked.lastActivityAt))}
                  </dd>
                </div>
                {checked.preferredServices.length ? (
                  <div>
                    <dt>Preferred services</dt>
                    <dd className="text-ink mt-1">{checked.preferredServices.join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
          {checked.enquiries.length || checked.projects.length || checked.activity.length ? (
            <div className="border-line mt-6 grid gap-6 border-t pt-5 md:grid-cols-2">
              {checked.enquiries.length ? (
                <div>
                  <h3 className="text-sm font-medium">Recent Enquiries</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {checked.enquiries.slice(0, 3).map((enquiry) => (
                      <li key={enquiry.id} className="flex items-center justify-between gap-3">
                        <Link href={`/ops/enquiries/${enquiry.id}`} className="underline">
                          {enquiry.projectType}
                        </Link>
                        <StatusBadge status={enquiry.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {checked.projects.length ? (
                <div>
                  <h3 className="text-sm font-medium">Recent Projects</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {checked.projects
                      .filter((project) => !project.archived)
                      .slice(0, 3)
                      .map((project) => (
                        <li key={project.id} className="flex items-center justify-between gap-3">
                          <Link href={`/ops/projects/${project.id}`} className="underline">
                            {project.name}
                          </Link>
                          <span className="text-ink-muted text-xs">{project.status}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="text-ink-muted mt-2 text-xs">
                    {checked.projects.length} linked project
                    {checked.projects.length === 1 ? "" : "s"}
                  </p>
                </div>
              ) : null}
              {checked.activity.length ? (
                <div>
                  <h3 className="text-sm font-medium">Recent Activity</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {checked.activity.slice(0, 3).map((entry) => (
                      <li key={entry.id}>
                        <p>{entry.message}</p>
                        <p className="text-ink-muted text-xs">{entry.relativeTime}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
