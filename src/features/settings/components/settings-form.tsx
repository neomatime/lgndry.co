"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { updateOpsSettings } from "@/features/settings/actions";
import { opsSettingsInputSchema } from "@/features/settings/schemas";
import { settingsInput } from "@/features/settings/settings-view-model";
import type { OpsSettings, OpsSettingsInput } from "@/features/settings/types";

type NumericKey =
  "defaultRetainerPercentage" | "defaultQuoteValidityDays" | "defaultDepositDueDays";
type TextKey = Exclude<keyof OpsSettingsInput, NumericKey>;
type EditableSettings = Omit<OpsSettingsInput, NumericKey> & Record<NumericKey, string>;
type Feedback =
  { status: "success" | "error"; message: string } | { status: "conflict"; message: string } | null;

const inputClass =
  "border-line-strong focus-visible:outline-ink h-10 w-full border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";
const textAreaClass =
  "border-line-strong focus-visible:outline-ink min-h-32 w-full resize-y border bg-white px-3 py-2 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2";

function editable(input: OpsSettingsInput): EditableSettings {
  return {
    ...input,
    defaultRetainerPercentage: String(input.defaultRetainerPercentage),
    defaultQuoteValidityDays: String(input.defaultQuoteValidityDays),
    defaultDepositDueDays: String(input.defaultDepositDueDays),
  };
}

function submitted(value: EditableSettings): OpsSettingsInput {
  return {
    ...value,
    defaultRetainerPercentage: Number(value.defaultRetainerPercentage),
    defaultQuoteValidityDays: Number(value.defaultQuoteValidityDays),
    defaultDepositDueDays: Number(value.defaultDepositDueDays),
  };
}

function errors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? (
    <p id={id} className="text-ink mt-1 text-xs font-medium">
      {messages.join(" ")}
    </p>
  ) : null;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line grid gap-5 border-b pb-8 last:border-b-0 last:pb-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm leading-6">{description}</p>
      </div>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ initialSettings }: { initialSettings: OpsSettings }) {
  const router = useRouter();
  const initial = editable(settingsInput(initialSettings));
  const [value, setValue] = useState<EditableSettings>(initial);
  const [baseline, setBaseline] = useState<EditableSettings>(initial);
  const [version, setVersion] = useState(initialSettings.version);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(value) !== JSON.stringify(baseline);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const setText = (key: TextKey, next: string) =>
    setValue((current) => ({ ...current, [key]: next }));
  const setNumber = (key: NumericKey, next: string) =>
    setValue((current) => ({ ...current, [key]: next }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback(null);
    const parsed = opsSettingsInputSchema.safeParse(submitted(value));
    if (!parsed.success) {
      setFieldErrors(errors(parsed.error));
      setFeedback({ status: "error", message: "Check the highlighted settings and try again." });
      return;
    }

    setFieldErrors({});
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await updateOpsSettings(parsed.data, version);
        if (result.status === "invalid") {
          setFieldErrors(result.fieldErrors);
          setFeedback({ status: "error", message: result.message });
          return;
        }
        if (result.status === "conflict") {
          setFeedback({ status: "conflict", message: result.message });
          return;
        }
        if (result.status === "error") {
          setFeedback({ status: "error", message: result.message });
          return;
        }
        const saved = editable(parsed.data);
        setValue(saved);
        setBaseline(saved);
        setVersion(result.version);
        setFeedback({ status: "success", message: "Settings saved." });
      } finally {
        submitting.current = false;
      }
    });
  };

  const inputProps = (key: TextKey) => ({
    value: value[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setText(key, event.target.value),
    "aria-invalid": Boolean(fieldErrors[key]?.length),
    "aria-describedby": fieldErrors[key]?.length ? `${key}-error` : undefined,
  });

  const general = (
    <div className="flex flex-col gap-8">
      <Section
        title="Workspace Profile"
        description="The business details used throughout the Command Center and future documents."
      >
        <label className="text-sm font-medium sm:col-span-2">
          Workspace name
          <input className={`${inputClass} mt-1.5`} {...inputProps("workspaceName")} />
          <FieldError id="workspaceName-error" messages={fieldErrors.workspaceName} />
        </label>
        <label className="text-sm font-medium">
          Company email
          <input
            type="email"
            autoComplete="email"
            className={`${inputClass} mt-1.5`}
            {...inputProps("companyEmail")}
          />
          <FieldError id="companyEmail-error" messages={fieldErrors.companyEmail} />
        </label>
        <label className="text-sm font-medium">
          Company phone
          <input
            type="tel"
            autoComplete="tel"
            className={`${inputClass} mt-1.5`}
            {...inputProps("companyPhone")}
          />
          <FieldError id="companyPhone-error" messages={fieldErrors.companyPhone} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Website
          <input
            type="url"
            autoComplete="url"
            placeholder="https://"
            className={`${inputClass} mt-1.5`}
            {...inputProps("websiteUrl")}
          />
          <FieldError id="websiteUrl-error" messages={fieldErrors.websiteUrl} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Business address
          <textarea
            value={value.businessAddress}
            onChange={(event) => setText("businessAddress", event.target.value)}
            className={`${textAreaClass} mt-1.5`}
            aria-invalid={Boolean(fieldErrors.businessAddress?.length)}
            aria-describedby={
              fieldErrors.businessAddress?.length ? "businessAddress-error" : undefined
            }
          />
          <FieldError id="businessAddress-error" messages={fieldErrors.businessAddress} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Registration number <span className="text-ink-muted font-normal">(optional)</span>
          <input className={`${inputClass} mt-1.5`} {...inputProps("registrationNumber")} />
          <FieldError id="registrationNumber-error" messages={fieldErrors.registrationNumber} />
        </label>
      </Section>

      <Section
        title="Brand & Identity"
        description="The approved brand mark and fixed South African commercial locale."
      >
        <div className="border-line bg-surface-soft flex min-h-36 items-center justify-center border p-6 sm:col-span-2">
          <Image
            src="/assests/logos/LGNDRY.CO Final.png"
            alt="LGNDRY.Co logo"
            width={420}
            height={150}
            className="h-auto max-h-24 w-auto max-w-full object-contain"
          />
        </div>
        <label className="text-sm font-medium">
          Time zone
          <input
            readOnly
            value={initialSettings.timeZone}
            className={`${inputClass} bg-surface-soft text-ink-muted mt-1.5`}
          />
        </label>
        <label className="text-sm font-medium">
          Currency
          <input
            readOnly
            value={initialSettings.currency}
            className={`${inputClass} bg-surface-soft text-ink-muted mt-1.5`}
          />
        </label>
      </Section>
    </div>
  );

  const commercial = (
    <div className="flex flex-col gap-8">
      <Section
        title="Quote Defaults"
        description="Copied into each new quote draft. Quotes cannot be sent until terms are provided."
      >
        <label className="text-sm font-medium sm:col-span-2">
          Default quote terms
          <textarea
            value={value.defaultQuoteTerms}
            onChange={(event) => setText("defaultQuoteTerms", event.target.value)}
            className={`${textAreaClass} mt-1.5 min-h-56`}
            placeholder="Type the terms clients should receive with new quotes."
            aria-invalid={Boolean(fieldErrors.defaultQuoteTerms?.length)}
            aria-describedby={
              fieldErrors.defaultQuoteTerms?.length ? "defaultQuoteTerms-error" : undefined
            }
          />
          <FieldError id="defaultQuoteTerms-error" messages={fieldErrors.defaultQuoteTerms} />
        </label>
        <label className="text-sm font-medium">
          Booking retainer (%)
          <input
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={value.defaultRetainerPercentage}
            onChange={(event) => setNumber("defaultRetainerPercentage", event.target.value)}
            className={`${inputClass} mt-1.5`}
            aria-invalid={Boolean(fieldErrors.defaultRetainerPercentage?.length)}
            aria-describedby={
              fieldErrors.defaultRetainerPercentage?.length
                ? "defaultRetainerPercentage-error"
                : undefined
            }
          />
          <FieldError
            id="defaultRetainerPercentage-error"
            messages={fieldErrors.defaultRetainerPercentage}
          />
        </label>
        <label className="text-sm font-medium">
          Quote validity (days)
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            value={value.defaultQuoteValidityDays}
            onChange={(event) => setNumber("defaultQuoteValidityDays", event.target.value)}
            className={`${inputClass} mt-1.5`}
            aria-invalid={Boolean(fieldErrors.defaultQuoteValidityDays?.length)}
            aria-describedby={
              fieldErrors.defaultQuoteValidityDays?.length
                ? "defaultQuoteValidityDays-error"
                : undefined
            }
          />
          <FieldError
            id="defaultQuoteValidityDays-error"
            messages={fieldErrors.defaultQuoteValidityDays}
          />
        </label>
        <label className="text-sm font-medium">
          Deposit invoice due (days)
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            value={value.defaultDepositDueDays}
            onChange={(event) => setNumber("defaultDepositDueDays", event.target.value)}
            className={`${inputClass} mt-1.5`}
            aria-invalid={Boolean(fieldErrors.defaultDepositDueDays?.length)}
            aria-describedby={
              fieldErrors.defaultDepositDueDays?.length ? "defaultDepositDueDays-error" : undefined
            }
          />
          <FieldError
            id="defaultDepositDueDays-error"
            messages={fieldErrors.defaultDepositDueDays}
          />
        </label>
      </Section>

      <Section
        title="Payment Details"
        description="These details will be copied into future issued invoices and payment emails."
      >
        <label className="text-sm font-medium">
          Bank name
          <input className={`${inputClass} mt-1.5`} {...inputProps("bankName")} />
          <FieldError id="bankName-error" messages={fieldErrors.bankName} />
        </label>
        <label className="text-sm font-medium">
          Account holder
          <input className={`${inputClass} mt-1.5`} {...inputProps("accountHolder")} />
          <FieldError id="accountHolder-error" messages={fieldErrors.accountHolder} />
        </label>
        <label className="text-sm font-medium">
          Account number
          <input
            autoComplete="off"
            className={`${inputClass} mt-1.5`}
            {...inputProps("accountNumber")}
          />
          <FieldError id="accountNumber-error" messages={fieldErrors.accountNumber} />
        </label>
        <label className="text-sm font-medium">
          Branch code
          <input className={`${inputClass} mt-1.5`} {...inputProps("branchCode")} />
          <FieldError id="branchCode-error" messages={fieldErrors.branchCode} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Account type
          <input className={`${inputClass} mt-1.5`} {...inputProps("accountType")} />
          <FieldError id="accountType-error" messages={fieldErrors.accountType} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Payment reference instructions
          <textarea
            value={value.paymentReferenceInstructions}
            onChange={(event) => setText("paymentReferenceInstructions", event.target.value)}
            className={`${textAreaClass} mt-1.5`}
            aria-invalid={Boolean(fieldErrors.paymentReferenceInstructions?.length)}
            aria-describedby={
              fieldErrors.paymentReferenceInstructions?.length
                ? "paymentReferenceInstructions-error"
                : undefined
            }
          />
          <FieldError
            id="paymentReferenceInstructions-error"
            messages={fieldErrors.paymentReferenceInstructions}
          />
        </label>
      </Section>

      <Section
        title="Email Identity"
        description="The sender clients will see. Resend credentials remain securely configured in Vercel."
      >
        <label className="text-sm font-medium sm:col-span-2">
          Sender name
          <input className={`${inputClass} mt-1.5`} {...inputProps("senderName")} />
          <FieldError id="senderName-error" messages={fieldErrors.senderName} />
        </label>
        <label className="text-sm font-medium">
          Sender email
          <input type="email" className={`${inputClass} mt-1.5`} {...inputProps("senderEmail")} />
          <FieldError id="senderEmail-error" messages={fieldErrors.senderEmail} />
        </label>
        <label className="text-sm font-medium">
          Reply-to email
          <input type="email" className={`${inputClass} mt-1.5`} {...inputProps("replyToEmail")} />
          <FieldError id="replyToEmail-error" messages={fieldErrors.replyToEmail} />
        </label>
      </Section>
    </div>
  );

  return (
    <form onSubmit={submit} className="w-full min-w-0">
      {feedback ? (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role={feedback.status === "success" ? "status" : "alert"}
          className="border-line bg-surface-soft mb-5 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm"
        >
          <span>{feedback.message}</span>
          {feedback.status === "conflict" ? (
            <Button type="button" variant="secondary" onClick={() => router.refresh()}>
              Load current settings
            </Button>
          ) : null}
        </div>
      ) : null}

      <Tabs
        items={[
          { id: "general", label: "General", content: general },
          { id: "commercial", label: "Quotes & Invoices", content: commercial },
        ]}
      />

      <div className="border-line mt-8 flex flex-wrap justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="secondary"
          disabled={!dirty || pending}
          onClick={() => {
            setValue(baseline);
            setFieldErrors({});
            setFeedback(null);
          }}
        >
          Discard Changes
        </Button>
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
