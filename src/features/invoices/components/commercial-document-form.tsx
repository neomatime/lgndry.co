"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createInvoice,
  createQuote,
  updateInvoice,
  updateQuote,
} from "@/features/invoices/actions";
import type {
  BillingType,
  CommercialFormData,
  InvoiceDetail,
  QuoteDetail,
} from "@/features/invoices/types";
import { calculateTotals, money } from "@/features/invoices/view-model";
import { Button } from "@/components/ui/button";

type Line = { description: string; quantity: string; unitAmount: string };
type Props =
  | { kind: "quote"; data: CommercialFormData; initial?: QuoteDetail }
  | { kind: "invoice"; data: CommercialFormData; initial?: InvoiceDetail };

const inputClass = "border-line-strong bg-surface h-10 w-full border px-3 text-sm outline-none";
const textareaClass =
  "border-line-strong bg-surface min-h-28 w-full border px-3 py-2 text-sm outline-none";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium">{error}</span> : null}
    </label>
  );
}

export function CommercialDocumentForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = props.initial;
  const quoteInitial = props.kind === "quote" ? props.initial : undefined;
  const invoiceInitial = props.kind === "invoice" ? props.initial : undefined;
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [contactId, setContactId] = useState(initial?.contactId ?? "");
  const [relatedKind, setRelatedKind] = useState<"none" | "enquiry" | "project">(
    initial?.enquiryId ? "enquiry" : initial?.projectId ? "project" : "none",
  );
  const [relatedId, setRelatedId] = useState(initial?.enquiryId ?? initial?.projectId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [overview, setOverview] = useState(initial?.overview ?? "");
  const [notes, setNotes] = useState(invoiceInitial?.notes ?? "");
  const [services, setServices] = useState(quoteInitial?.services.join(", ") ?? "");
  const [location, setLocation] = useState(quoteInitial?.location ?? "");
  const [billingType, setBillingType] = useState(invoiceInitial?.billingType ?? "Standard");
  const [issueDate, setIssueDate] = useState(invoiceInitial?.issueDate ?? "");
  const [dueDate, setDueDate] = useState(invoiceInitial?.dueDate ?? "");
  const [retainer, setRetainer] = useState(
    String(quoteInitial?.retainerPercentage ?? props.data.defaults.retainerPercentage),
  );
  const [terms, setTerms] = useState(quoteInitial?.terms ?? props.data.defaults.terms);
  const [discount, setDiscount] = useState(String(initial?.discountAmount ?? 0));
  const [lines, setLines] = useState<Line[]>(
    initial?.lineItems.length
      ? initial.lineItems.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unitAmount: String(item.unitAmount),
        }))
      : [{ description: "", quantity: "1", unitAmount: "0" }],
  );
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const client = props.data.clients.find((item) => item.id === clientId);
  const totals = useMemo(
    () =>
      calculateTotals(
        lines.map((line) => ({
          quantity: Number(line.quantity) || 0,
          unitAmount: Number(line.unitAmount) || 0,
        })),
        Number(discount) || 0,
      ),
    [lines, discount],
  );

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line, row) => (row === index ? { ...line, ...patch } : line)),
    );

  const submit = () => {
    setMessage("");
    setErrors({});
    const base = {
      clientId,
      contactId,
      enquiryId: relatedKind === "enquiry" ? relatedId : "",
      projectId: relatedKind === "project" ? relatedId : "",
      title,
      overview,
      discountAmount: discount || "0",
      lineItems: lines,
    };
    startTransition(async () => {
      const result =
        props.kind === "quote"
          ? initial
            ? await updateQuote(
                initial.id,
                {
                  ...base,
                  services: services
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                  location,
                  retainerPercentage: retainer,
                  terms,
                },
                initial.version,
              )
            : await createQuote({
                ...base,
                services: services
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                location,
                retainerPercentage: retainer,
                terms,
              })
          : invoiceInitial
            ? await updateInvoice(
                invoiceInitial.id,
                { ...base, notes, billingType, issueDate, dueDate },
                invoiceInitial.version,
              )
            : await createInvoice({ ...base, notes, billingType, issueDate, dueDate });
      if (result.status === "success") {
        router.push(
          props.kind === "quote"
            ? `/ops/invoices/quotes/${result.id}`
            : `/ops/invoices/${result.id}`,
        );
        router.refresh();
        return;
      }
      if (result.status === "invalid" && result.fieldErrors) setErrors(result.fieldErrors);
      setMessage(result.message);
    });
  };

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <section className="border-line border p-5">
          <h2 className="text-lg font-medium">Client and Record</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Client" error={errors.clientId?.[0]}>
              <select
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setContactId("");
                  setRelatedKind("none");
                  setRelatedId("");
                }}
                className={inputClass}
              >
                <option value="">Choose a client</option>
                {props.data.clients.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Billing Contact" error={errors.contactId?.[0]}>
              <select
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                className={inputClass}
              >
                <option value="">Choose a contact</option>
                {(client?.contacts ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} · {contact.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Related Record">
              <select
                value={relatedKind}
                onChange={(event) => {
                  setRelatedKind(event.target.value as typeof relatedKind);
                  setRelatedId("");
                }}
                className={inputClass}
              >
                <option value="none">No related record</option>
                <option value="enquiry">Enquiry</option>
                <option value="project">Project</option>
              </select>
            </Field>
            <Field
              label={
                relatedKind === "enquiry"
                  ? "Enquiry"
                  : relatedKind === "project"
                    ? "Project"
                    : "Selection"
              }
            >
              <select
                value={relatedId}
                onChange={(event) => setRelatedId(event.target.value)}
                disabled={relatedKind === "none"}
                className={inputClass}
              >
                <option value="">{relatedKind === "none" ? "Not applicable" : "Choose one"}</option>
                {(relatedKind === "enquiry"
                  ? client?.enquiries
                  : relatedKind === "project"
                    ? client?.projects
                    : []
                )?.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={props.kind === "quote" ? "Quote Title" : "Invoice Title"}
              error={errors.title?.[0]}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </Field>
            {props.kind === "invoice" ? (
              <Field label="Billing Type">
                <select
                  value={billingType}
                  onChange={(event) => setBillingType(event.target.value as BillingType)}
                  className={inputClass}
                >
                  <option>Standard</option>
                  <option>Deposit</option>
                  <option>Balance</option>
                </select>
              </Field>
            ) : (
              <Field label="Location">
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
          </div>
          <div className="mt-4">
            <Field label="Overview">
              <textarea
                value={overview}
                onChange={(event) => setOverview(event.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>
          {props.kind === "quote" ? (
            <div className="mt-4">
              <Field label="Services (comma separated)">
                <input
                  value={services}
                  onChange={(event) => setServices(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          ) : (
            <div className="mt-4">
              <Field label="Internal Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={textareaClass}
                />
              </Field>
            </div>
          )}
        </section>

        <section className="border-line border p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Line Items</h2>
            <Button
              variant="secondary"
              className="h-9 px-3"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { description: "", quantity: "1", unitAmount: "0" },
                ])
              }
            >
              <Plus className="size-4" aria-hidden="true" /> Add Item
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_7rem_9rem_2.5rem]">
                <input
                  aria-label={`Item ${index + 1} description`}
                  placeholder="Description"
                  value={line.description}
                  onChange={(event) => setLine(index, { description: event.target.value })}
                  className={inputClass}
                />
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => setLine(index, { quantity: event.target.value })}
                  className={inputClass}
                />
                <input
                  aria-label={`Item ${index + 1} unit amount`}
                  inputMode="decimal"
                  value={line.unitAmount}
                  onChange={(event) => setLine(index, { unitAmount: event.target.value })}
                  className={inputClass}
                />
                <button
                  type="button"
                  title="Remove line item"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((_, row) => row !== index))}
                  className="border-line-strong flex size-10 items-center justify-center border disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {props.kind === "quote" ? (
          <section className="border-line border p-5">
            <h2 className="text-lg font-medium">Approval and Terms</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Booking Retainer (%)">
                <input
                  inputMode="decimal"
                  value={retainer}
                  onChange={(event) => setRetainer(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Discount (ZAR)">
                <input
                  inputMode="decimal"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Terms">
                <textarea
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  className={`${textareaClass} min-h-48`}
                />
              </Field>
            </div>
          </section>
        ) : (
          <section className="border-line border p-5">
            <h2 className="text-lg font-medium">Dates and Discount</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Issue Date">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Due Date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Discount (ZAR)">
                <input
                  inputMode="decimal"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>
        )}
      </div>

      <aside className="border-line h-fit border p-5 xl:sticky xl:top-20">
        <h2 className="text-lg font-medium">Summary</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd>{money(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Discount</dt>
            <dd>- {money(totals.discountAmount)}</dd>
          </div>
          <div className="border-line flex justify-between gap-4 border-t pt-3 text-base font-medium">
            <dt>Total</dt>
            <dd>{money(totals.total)}</dd>
          </div>
          {props.kind === "quote" ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Deposit</dt>
              <dd>{money((totals.total * (Number(retainer) || 0)) / 100)}</dd>
            </div>
          ) : null}
        </dl>
        {message ? (
          <p role="alert" className="mt-5 text-sm font-medium">
            {message}
          </p>
        ) : null}
        <Button className="mt-6 w-full" disabled={pending} onClick={submit}>
          {pending
            ? "Saving..."
            : initial
              ? "Save Draft"
              : props.kind === "quote"
                ? "Create Quote Draft"
                : "Create Invoice Draft"}
        </Button>
      </aside>
    </div>
  );
}
