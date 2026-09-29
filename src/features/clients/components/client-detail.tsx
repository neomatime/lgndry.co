import { Calendar, ChevronLeft, Mail, Pencil, Star, Tag, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { ClientArchiveControl } from "@/features/clients/components/client-archive-control";
import { AccountTierBadge, ClientStatusBadge } from "@/features/clients/components/client-badges";
import type { ClientDetail } from "@/features/clients/detail-view-model";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

function localDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border p-5">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ClientDetailView({ client }: { client: ClientDetail }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="text-ink-muted flex items-center gap-1 text-sm">
        <Link href="/ops/clients" className="hover:text-ink underline">
          Clients
        </Link>
        <span>/</span>
        <span>{client.name}</span>
      </div>

      <PageHeader
        title={client.name}
        description={client.contacts.find((contact) => contact.isPrimary)?.fullName ?? client.type}
        actions={
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Link
              href="/ops/clients"
              className="border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center gap-2 border bg-white px-4 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back to Clients
            </Link>
            {!client.archived ? (
              <Link
                href={`/ops/clients/${client.id}/edit`}
                className="border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center gap-2 border bg-white px-4 text-sm font-medium transition-colors"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit Client
              </Link>
            ) : null}
            <ClientArchiveControl
              clientId={client.id}
              clientName={client.name}
              archived={client.archived}
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Tag}
          label="Status"
          value={<ClientStatusBadge status={client.status} archived={client.archived} />}
        />
        <StatCard icon={Star} label="Tier" value={<AccountTierBadge tier={client.accountTier} />} />
        <StatCard icon={Users} label="Contacts" value={client.contacts.length} />
        <StatCard icon={Mail} label="Open Enquiries" value={client.openEnquiryCount} />
        <StatCard icon={Calendar} label="Client Since" value={localDate(client.clientSince)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title="Account Overview">
            <p className="text-ink-muted text-sm whitespace-pre-line">
              {client.accountOverview ?? "No account overview recorded yet."}
            </p>
          </Panel>

          <Panel title="Preferred Services / Scope">
            {client.preferredServices.length ? (
              <ul className="flex flex-wrap gap-2">
                {client.preferredServices.map((service) => (
                  <li key={service} className="bg-line px-3 py-1.5 text-xs font-medium">
                    {service}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted text-sm">No preferred services recorded yet.</p>
            )}
          </Panel>

          <Panel title={`Linked Enquiries (${client.enquiries.length})`}>
            {client.enquiries.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-line border-b text-left">
                      <th className="pr-4 pb-2">Enquiry</th>
                      <th className="pr-4 pb-2">Service</th>
                      <th className="pr-4 pb-2">Submitted</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.enquiries.map((enquiry) => (
                      <tr key={enquiry.id} className="border-line border-b last:border-b-0">
                        <td className="py-3 pr-4">
                          <Link href={`/ops/enquiries/${enquiry.id}`} className="underline">
                            {enquiry.id.slice(0, 8).toUpperCase()}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">{enquiry.projectType}</td>
                        <td className="py-3 pr-4">
                          {dateFormatter.format(new Date(enquiry.createdAt))}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={enquiry.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-ink-muted text-sm">No enquiries are linked to this client.</p>
            )}
          </Panel>

          <Panel title="Relationship Notes">
            <p className="text-ink-muted text-sm whitespace-pre-line">
              {client.relationshipNotes ?? "No relationship notes recorded yet."}
            </p>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Client Details">
            <dl className="text-ink-muted space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Client ID</dt>
                <dd className="text-ink break-all">{client.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Type</dt>
                <dd className="text-ink">{client.type}</dd>
              </div>
              {client.industry ? (
                <div className="flex justify-between gap-4">
                  <dt>Industry</dt>
                  <dd className="text-ink text-right">{client.industry}</dd>
                </div>
              ) : null}
              {client.region ? (
                <div className="flex justify-between gap-4">
                  <dt>Region</dt>
                  <dd className="text-ink text-right">{client.region}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt>Status</dt>
                <dd>
                  <ClientStatusBadge status={client.status} archived={client.archived} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Tier</dt>
                <dd>
                  <AccountTierBadge tier={client.accountTier} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Client since</dt>
                <dd className="text-ink">{localDate(client.clientSince)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title={`Contacts (${client.contacts.length})`}>
            {client.contacts.length ? (
              <ul className="space-y-4">
                {client.contacts.map((contact) => (
                  <li
                    key={contact.id}
                    className="border-line border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{contact.fullName}</p>
                      {contact.isPrimary ? (
                        <span className="border-line-strong text-ink-muted border px-2 py-0.5 text-xs">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    {contact.roleTitle ? (
                      <p className="text-ink-muted mt-1 text-xs">{contact.roleTitle}</p>
                    ) : null}
                    <a href={`mailto:${contact.email}`} className="mt-2 block text-sm underline">
                      {contact.email}
                    </a>
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="mt-1 block text-sm underline">
                        {contact.phone}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted text-sm">No contacts recorded.</p>
            )}
          </Panel>

          <Panel title="Recent Activity">
            {client.activity.length ? (
              <ol className="space-y-3">
                {client.activity.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p>{entry.message}</p>
                    <p className="text-ink-muted mt-0.5 text-xs">{entry.relativeTime}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-muted text-sm">No activity recorded yet.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
