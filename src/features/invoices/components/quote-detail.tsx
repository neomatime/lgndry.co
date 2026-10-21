import { CalendarDays, CircleDollarSign, FileText, Pencil, UserRound } from "lucide-react";
import Link from "next/link";
import { CommercialStatusBadge } from "@/features/invoices/components/commercial-badges";
import { QuoteActions } from "@/features/invoices/components/quote-actions";
import type { QuoteDetail as QuoteDetailType } from "@/features/invoices/types";
import { money } from "@/features/invoices/view-model";

export function QuoteDetail({ quote }: { quote: QuoteDetailType }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ink-muted text-sm">Quotes / {quote.reference}</p>
          <h1 className="mt-2 text-3xl font-medium">{quote.title}</h1>
          <p className="text-ink-muted mt-1">
            {quote.clientName} · Revision {quote.revision}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href="/ops/invoices/quotes"
            className="border-line-strong inline-flex h-10 items-center border px-4 text-sm font-medium"
          >
            Back to Quotes
          </Link>
          {quote.status === "Draft" ? (
            <Link
              href={`/ops/invoices/quotes/${quote.id}/edit`}
              className="border-line-strong inline-flex h-10 items-center gap-2 border px-4 text-sm font-medium"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit Quote
            </Link>
          ) : null}
          <QuoteActions quote={quote} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="border-line flex items-center gap-3 border p-4">
          <FileText className="size-5" />
          <div>
            <p className="text-ink-muted text-xs">Status</p>
            <CommercialStatusBadge status={quote.status} />
          </div>
        </div>
        <div className="border-line flex items-center gap-3 border p-4">
          <CircleDollarSign className="size-5" />
          <div>
            <p className="text-ink-muted text-xs">Total</p>
            <p className="font-medium">{money(quote.total)}</p>
          </div>
        </div>
        <div className="border-line flex items-center gap-3 border p-4">
          <CircleDollarSign className="size-5" />
          <div>
            <p className="text-ink-muted text-xs">Retainer</p>
            <p className="font-medium">
              {quote.retainerPercentage}% · {money((quote.total * quote.retainerPercentage) / 100)}
            </p>
          </div>
        </div>
        <div className="border-line flex items-center gap-3 border p-4">
          <CalendarDays className="size-5" />
          <div>
            <p className="text-ink-muted text-xs">Valid Until</p>
            <p className="font-medium">{quote.validUntil || "Not issued"}</p>
          </div>
        </div>
        <div className="border-line flex items-center gap-3 border p-4">
          <UserRound className="size-5" />
          <div>
            <p className="text-ink-muted text-xs">Owner</p>
            <p className="font-medium">{quote.owner.name}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <section className="border-line border p-5">
            <h2 className="text-lg font-medium">Quote Overview</h2>
            <p className="text-ink-muted mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {quote.overview || "No overview added."}
            </p>
            {quote.services.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {quote.services.map((service) => (
                  <span key={service} className="bg-surface-soft px-3 py-1 text-xs">
                    {service}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
          <section className="border-line border p-5">
            <h2 className="text-lg font-medium">Line Items</h2>
            <table className="mt-4 w-full table-fixed text-sm">
              <thead className="bg-surface-soft text-left">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="w-20 px-3 py-2 text-right">Qty</th>
                  <th className="w-32 px-3 py-2 text-right">Unit</th>
                  <th className="w-32 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((item) => (
                  <tr key={item.id ?? item.description} className="border-line border-t">
                    <td className="px-3 py-2">{item.description}</td>
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
                  <td className="px-3 py-2 text-right">{money(quote.subtotal)}</td>
                </tr>
                {quote.discountAmount ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Discount
                    </td>
                    <td className="px-3 py-2 text-right">- {money(quote.discountAmount)}</td>
                  </tr>
                ) : null}
                <tr className="font-medium">
                  <td colSpan={3} className="px-3 py-2 text-right">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right">{money(quote.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          <section className="border-line border p-5">
            <h2 className="text-lg font-medium">Terms</h2>
            <p className="text-ink-muted mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {quote.terms || "No terms added."}
            </p>
          </section>
        </div>
        <aside className="space-y-4">
          <section className="border-line border p-4">
            <h2 className="font-medium">Quote Details</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Quote ID</dt>
                <dd>{quote.reference}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Client</dt>
                <dd>
                  <Link href={`/ops/clients/${quote.clientId}`} className="underline">
                    {quote.clientName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Contact</dt>
                <dd>{quote.contactName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Location</dt>
                <dd>{quote.location || "Not recorded"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Currency</dt>
                <dd>ZAR</dd>
              </div>
            </dl>
          </section>
          <section className="border-line border p-4">
            <h2 className="font-medium">Approval</h2>
            <p className="text-ink-muted mt-3 text-sm">
              {quote.status === "Approved"
                ? `Approved ${quote.approvedAt}`
                : quote.status === "Sent"
                  ? "Awaiting client approval."
                  : "Send this draft to create a private approval link."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
