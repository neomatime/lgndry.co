"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { approvePublicQuote } from "@/features/invoices/actions";
import type { PublicQuote as PublicQuoteType } from "@/features/invoices/types";
import { money } from "@/features/invoices/view-model";

export function PublicQuote({ quote, token }: { quote: PublicQuoteType; token: string }) {
  const [status, setStatus] = useState(quote.status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const approved = status === "Approved";
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-10 sm:px-8 lg:py-16">
      <header className="border-line flex flex-wrap items-start justify-between gap-6 border-b pb-8">
        <div>
          <p className="font-serif text-3xl">LGNDRY.Co</p>
          <p className="text-ink-muted mt-1 text-xs tracking-[0.22em] uppercase">
            Creative Operations
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">
            {quote.reference} / R{quote.revision}
          </p>
          <p className="text-ink-muted">Valid until {quote.validUntil}</p>
        </div>
      </header>
      <section className="py-10">
        <p className="text-ink-muted text-sm">Prepared for {quote.clientName}</p>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-none">{quote.title}</h1>
        <p className="text-ink-muted mt-6 max-w-3xl leading-relaxed whitespace-pre-wrap">
          {quote.overview}
        </p>
      </section>
      <section className="border-line border">
        <div className="bg-surface-soft grid grid-cols-[minmax(0,1fr)_5rem_9rem] px-4 py-3 text-xs font-medium">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Amount</span>
        </div>
        {quote.lineItems.map((item) => (
          <div
            key={item.description}
            className="border-line grid grid-cols-[minmax(0,1fr)_5rem_9rem] border-t px-4 py-4 text-sm"
          >
            <span>{item.description}</span>
            <span className="text-right">{item.quantity}</span>
            <span className="text-right">{money(item.lineTotal)}</span>
          </div>
        ))}
        <dl className="border-line ml-auto w-full max-w-sm border-t p-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(quote.subtotal)}</dd>
          </div>
          {quote.discountAmount ? (
            <div className="mt-2 flex justify-between">
              <dt>Discount</dt>
              <dd>- {money(quote.discountAmount)}</dd>
            </div>
          ) : null}
          <div className="border-line mt-3 flex justify-between border-t pt-3 text-lg font-medium">
            <dt>Total</dt>
            <dd>{money(quote.total)}</dd>
          </div>
          <div className="text-ink-muted mt-2 flex justify-between">
            <dt>Booking retainer</dt>
            <dd>{money((quote.total * quote.retainerPercentage) / 100)}</dd>
          </div>
        </dl>
      </section>
      <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="text-lg font-medium">Terms</h2>
          <p className="text-ink-muted mt-3 text-sm leading-relaxed whitespace-pre-wrap">
            {quote.terms}
          </p>
        </div>
        <aside className="border-line h-fit border p-5">
          {approved ? (
            <>
              <span className="bg-ink flex size-10 items-center justify-center rounded-full text-white">
                <Check className="size-5" />
              </span>
              <h2 className="mt-4 text-xl font-medium">Quote Approved</h2>
              <p className="text-ink-muted mt-2 text-sm">
                Thank you. Your deposit invoice has been created and the payment details are shown
                below.
              </p>
              {quote.depositInvoice ? (
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt>Deposit</dt>
                    <dd>{money(quote.depositInvoice.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Due</dt>
                    <dd>{quote.depositInvoice.dueDate}</dd>
                  </div>
                  <div className="border-line mt-3 border-t pt-3">
                    <dt className="font-medium">Banking Details</dt>
                    <dd className="text-ink-muted mt-2 space-y-1 break-words">
                      <span className="block">{quote.depositInvoice.payment.bank_name}</span>
                      <span className="block">{quote.depositInvoice.payment.account_holder}</span>
                      <span className="block">{quote.depositInvoice.payment.account_number}</span>
                      <span className="block">
                        Branch: {quote.depositInvoice.payment.branch_code}
                      </span>
                      <span className="block">Reference: {quote.depositInvoice.reference}</span>
                    </dd>
                  </div>
                </dl>
              ) : null}
            </>
          ) : status === "Expired" ? (
            <>
              <h2 className="text-xl font-medium">Quote Expired</h2>
              <p className="text-ink-muted mt-2 text-sm">
                Please contact LGNDRY.Co for an updated quote.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-medium">Ready to proceed?</h2>
              <p className="text-ink-muted mt-2 text-sm">
                Approving confirms the scope, pricing and terms shown here. Approval cannot be
                reversed from this page.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await approvePublicQuote(token);
                    if (result.status === "success") {
                      setStatus("Approved");
                      location.reload();
                    } else if (result.status === "expired") setStatus("Expired");
                    else setMessage("We couldn't record your approval. Please try again.");
                  })
                }
                className="bg-ink mt-5 h-11 w-full px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? "Approving..." : "Approve Quote"}
              </button>
              {message ? (
                <p role="alert" className="mt-3 text-sm font-medium">
                  {message}
                </p>
              ) : null}
            </>
          )}
        </aside>
      </section>
      <footer className="border-line text-ink-muted border-t pt-6 text-xs">
        {quote.company.business_address}
        <br />
        {quote.company.company_email} · {quote.company.company_phone}
      </footer>
    </main>
  );
}
