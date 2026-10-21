import { CalendarDays, CircleDollarSign, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { CommercialStatusBadge } from "@/features/invoices/components/commercial-badges";
import { InvoiceActions } from "@/features/invoices/components/invoice-actions";
import type { InvoiceDetail as InvoiceDetailType } from "@/features/invoices/types";
import { money } from "@/features/invoices/view-model";

const date = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});
const localDate = (value: string) =>
  value ? date.format(new Date(`${value}T12:00:00+02:00`)) : "Not set";

function Summary({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof FileText;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-line flex min-w-0 items-center gap-3 border p-4">
      <span className="bg-surface-soft flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-ink-muted text-xs">{label}</p>
        <div className="mt-1 truncate font-medium">{children}</div>
      </div>
    </div>
  );
}

export function InvoiceDetail({ invoice }: { invoice: InvoiceDetailType }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ink-muted text-sm">Invoices / {invoice.reference}</p>
          <h1 className="mt-2 text-3xl font-medium">{invoice.clientName} Invoice</h1>
          <p className="text-ink-muted mt-1">{invoice.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ops/invoices"
            className="border-line-strong inline-flex h-10 items-center border px-4 text-sm font-medium"
          >
            Back to Invoices
          </Link>
          <InvoiceActions invoice={invoice} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Summary icon={FileText} label="Status">
          <CommercialStatusBadge status={invoice.status} />
        </Summary>
        <Summary icon={CircleDollarSign} label="Payment State">
          <CommercialStatusBadge status={invoice.displayStatus} />
        </Summary>
        <Summary icon={CircleDollarSign} label="Amount">
          {money(invoice.total)}
        </Summary>
        <Summary icon={CalendarDays} label="Due Date">
          {localDate(invoice.dueDate)}
        </Summary>
        <Summary icon={UserRound} label="Owner">
          {invoice.owner.name}
        </Summary>
        <Summary icon={FileText} label="Billing Type">
          {invoice.billingType}
        </Summary>
      </div>
      <div className="border-line flex gap-7 border-b text-sm">
        <span className="border-ink border-b-2 px-2 py-3 font-medium">Overview</span>
        <span className="text-ink-muted px-2 py-3">Line Items</span>
        <span className="text-ink-muted px-2 py-3">Timeline</span>
        <span className="text-ink-muted hidden px-2 py-3 sm:block">Activity</span>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-4">
          <section className="border-line border p-4">
            <h2 className="text-lg font-medium">Invoice Overview</h2>
            <p className="text-ink-muted mt-3 text-sm leading-relaxed">
              {invoice.overview || invoice.title}
            </p>
          </section>
          <section className="border-line border p-4">
            <h2 className="text-lg font-medium">Billing Summary</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-medium">Billing Contact</h3>
                <dl className="mt-2 space-y-2 text-sm">
                  <div>
                    <dt className="sr-only">Name</dt>
                    <dd>{invoice.contact.name}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Email</dt>
                    <dd className="break-all">{invoice.contact.email}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Phone</dt>
                    <dd>{invoice.contact.phone || "No phone recorded"}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Company</dt>
                    <dd>{invoice.clientName}</dd>
                  </div>
                </dl>
              </div>
              <div className="border-line md:border-l md:pl-6">
                <h3 className="font-medium">Invoice Notes</h3>
                <p className="text-ink-muted mt-2 text-sm whitespace-pre-wrap">
                  {invoice.notes || "No internal notes."}
                </p>
              </div>
            </div>
          </section>
          <section className="border-line border p-4">
            <h2 className="text-lg font-medium">Line Items</h2>
            <div className="mt-4">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-surface-soft text-left">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="w-20 px-3 py-2 text-right">Qty</th>
                    <th className="w-32 px-3 py-2 text-right">Unit</th>
                    <th className="w-32 px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id ?? item.description} className="border-line border-t">
                      <td className="px-3 py-2 break-words">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{money(item.unitAmount)}</td>
                      <td className="px-3 py-2 text-right">{money(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-line border-t">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Subtotal
                    </td>
                    <td className="px-3 py-2 text-right">{money(invoice.subtotal)}</td>
                  </tr>
                  {invoice.discountAmount ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right">
                        Discount
                      </td>
                      <td className="px-3 py-2 text-right">- {money(invoice.discountAmount)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <th colSpan={3} className="bg-surface-soft px-3 py-2 text-right">
                      Total
                    </th>
                    <th className="bg-surface-soft px-3 py-2 text-right">{money(invoice.total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="border-line border p-4">
              <h2 className="font-medium">Payment History</h2>
              {invoice.payments.length ? (
                <ul className="mt-4 space-y-3 text-sm">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex justify-between gap-4">
                      <span>
                        {localDate(payment.paidOn)} · {payment.method}
                      </span>
                      <strong>{money(payment.amount)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted mt-4 text-sm">No payments recorded.</p>
              )}
            </section>
            <section className="border-line border p-4">
              <h2 className="font-medium">Recent Activity</h2>
              {invoice.activity.length ? (
                <ul className="mt-4 space-y-3 text-sm">
                  {invoice.activity.slice(0, 6).map((entry) => (
                    <li key={entry.id}>{entry.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted mt-4 text-sm">No activity yet.</p>
              )}
            </section>
          </div>
        </div>
        <aside className="space-y-4">
          <section className="border-line border p-4">
            <h2 className="font-medium">Invoice Details</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Invoice ID</dt>
                <dd>{invoice.reference}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Client</dt>
                <dd>
                  <Link href={`/ops/clients/${invoice.clientId}`} className="underline">
                    {invoice.clientName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Issue Date</dt>
                <dd>{localDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Due Date</dt>
                <dd>{localDate(invoice.dueDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Currency</dt>
                <dd>ZAR</dd>
              </div>
            </dl>
          </section>
          <section className="border-line border p-4">
            <h2 className="font-medium">Linked Records</h2>
            <ul className="mt-3 divide-y text-sm">
              {invoice.quoteId ? (
                <li className="py-2">
                  <Link
                    href={`/ops/invoices/quotes/${invoice.quoteId}`}
                    className="flex justify-between underline"
                  >
                    <span>Quote</span>
                    <span>{invoice.quoteReference}</span>
                  </Link>
                </li>
              ) : null}
              <li className="py-2">
                <Link
                  href={`/ops/clients/${invoice.clientId}`}
                  className="flex justify-between underline"
                >
                  <span>Client</span>
                  <span>{invoice.clientName}</span>
                </Link>
              </li>
              {invoice.projectId ? (
                <li className="py-2">
                  <Link
                    href={`/ops/projects/${invoice.projectId}`}
                    className="flex justify-between underline"
                  >
                    <span>Project</span>
                    <span>{invoice.projectName}</span>
                  </Link>
                </li>
              ) : null}
              {invoice.enquiryId ? (
                <li className="py-2">
                  <Link
                    href={`/ops/enquiries/${invoice.enquiryId}`}
                    className="flex justify-between underline"
                  >
                    <span>Enquiry</span>
                    <span>Open</span>
                  </Link>
                </li>
              ) : null}
            </ul>
          </section>
          <section className="border-line border p-4">
            <h2 className="font-medium">Outstanding Snapshot</h2>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">Invoice</dt>
                <dd className="mt-1 font-medium">{money(invoice.total)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Paid</dt>
                <dd className="mt-1 font-medium">{money(invoice.paidAmount)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Outstanding</dt>
                <dd className="mt-1 font-medium">{money(invoice.outstanding)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
