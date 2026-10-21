"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordPayment, sendInvoice, voidInvoice } from "@/features/invoices/actions";
import type { InvoiceDetail, PaymentMethod } from "@/features/invoices/types";
import { money } from "@/features/invoices/view-model";
import { Button } from "@/components/ui/button";

export function InvoiceActions({ invoice }: { invoice: InvoiceDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState(String(invoice.outstanding));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const run = (operation: "send" | "void" | "pay") => {
    setMessage("");
    startTransition(async () => {
      const result =
        operation === "send"
          ? await sendInvoice(invoice.id, invoice.version)
          : operation === "void"
            ? await voidInvoice(invoice.id, invoice.version)
            : await recordPayment(
                invoice.id,
                { amount, paidOn, method, reference: paymentReference, notes },
                invoice.version,
              );
      if (result.status === "success") {
        setShowPayment(false);
        router.refresh();
      } else setMessage(result.message);
    });
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {invoice.status === "Draft" && !invoice.quoteId ? (
        <Link
          href={`/ops/invoices/${invoice.id}/edit`}
          className="border-line-strong inline-flex h-10 items-center gap-2 border px-4 text-sm font-medium"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit Invoice
        </Link>
      ) : null}
      {invoice.status === "Draft" || invoice.status === "Sent" ? (
        <Button variant="secondary" disabled={pending} onClick={() => run("send")}>
          {invoice.status === "Draft" ? "Send Invoice" : "Resend Invoice"}
        </Button>
      ) : null}
      {invoice.status === "Sent" && invoice.outstanding > 0 ? (
        <Button disabled={pending} onClick={() => setShowPayment(true)}>
          Record Payment
        </Button>
      ) : null}
      {invoice.status !== "Paid" && invoice.status !== "Void" && invoice.paidAmount === 0 ? (
        <Button variant="secondary" disabled={pending} onClick={() => run("void")}>
          Void
        </Button>
      ) : null}
      {message ? (
        <p role="alert" className="basis-full text-right text-sm font-medium">
          {message}
        </p>
      ) : null}
      {showPayment ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Record payment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
        >
          <section className="border-line w-full max-w-lg border bg-white p-6">
            <h2 className="text-xl font-medium">Record Payment</h2>
            <p className="text-ink-muted mt-1 text-sm">Outstanding: {money(invoice.outstanding)}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Amount (ZAR)</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="border-line-strong h-10 w-full border px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Payment Date</span>
                <input
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  className="border-line-strong h-10 w-full border px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Method</span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  className="border-line-strong h-10 w-full border px-3"
                >
                  <option>Bank Transfer</option>
                  <option>Card</option>
                  <option>Cash</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Reference</span>
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  className="border-line-strong h-10 w-full border px-3"
                />
              </label>
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="border-line-strong min-h-24 w-full border p-3"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPayment(false)}>
                Cancel
              </Button>
              <Button disabled={pending} onClick={() => run("pay")}>
                {pending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
