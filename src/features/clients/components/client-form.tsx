"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient, updateClient } from "@/features/clients/actions";
import { clientInputSchema } from "@/features/clients/schemas";
import {
  ACCOUNT_TIERS,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  type ClientContactInput,
  type ClientInput,
} from "@/features/clients/types";

type ClientFormProps =
  | { mode: "create"; initialValue?: never }
  | { mode: "edit"; initialValue: ClientInput & { id: string } };

type EditableContact = ClientContactInput & { key: string };
type EditableValue = Omit<ClientInput, "contacts"> & { contacts: EditableContact[] };
type Feedback =
  | { status: "error"; message: string }
  | { status: "conflict"; message: string; clientId: string }
  | null;

const inputClass =
  "border-line-strong focus-visible:outline-ink h-10 w-full border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";
const textAreaClass =
  "border-line-strong focus-visible:outline-ink min-h-28 w-full resize-y border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

function todayInJohannesburg() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}

function blankContact(key: string): EditableContact {
  return {
    key,
    fullName: "",
    roleTitle: "",
    email: "",
    phone: "",
    isPrimary: true,
  };
}

function toContactInput(contact: EditableContact): ClientContactInput {
  return {
    id: contact.id,
    fullName: contact.fullName,
    roleTitle: contact.roleTitle,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
  };
}

function initialState(props: ClientFormProps): EditableValue {
  if (props.mode === "edit") {
    return {
      ...props.initialValue,
      contacts: props.initialValue.contacts.map((contact, index) => ({
        ...contact,
        key: contact.id ?? `existing-${index}`,
      })),
    };
  }
  return {
    name: "",
    type: "Individual",
    status: "Lead",
    accountTier: "Standard",
    industry: "",
    region: "",
    clientSince: todayInJohannesburg(),
    accountOverview: "",
    preferredServices: [],
    relationshipNotes: "",
    contacts: [blankContact("new-0")],
  };
}

function validationErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key =
      issue.path[0] === "preferredServices" ? "preferredServices" : issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? (
    <p id={id} className="text-ink mt-1 text-xs font-medium">
      {messages.join(" ")}
    </p>
  ) : null;
}

export function ClientForm(props: ClientFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<EditableValue>(() => initialState(props));
  const [serviceDraft, setServiceDraft] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const nextContactKey = useRef(value.contacts.length);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const setField = <Key extends keyof Omit<EditableValue, "contacts">>(
    key: Key,
    next: EditableValue[Key],
  ) => setValue((current) => ({ ...current, [key]: next }));

  const setContact = (index: number, patch: Partial<ClientContactInput>) => {
    setValue((current) => ({
      ...current,
      contacts: current.contacts.map((contact, position) =>
        position === index ? { ...contact, ...patch } : contact,
      ),
    }));
  };

  const setPrimary = (index: number) => {
    setValue((current) => ({
      ...current,
      contacts: current.contacts.map((contact, position) => ({
        ...contact,
        isPrimary: position === index,
      })),
    }));
  };

  const addContact = () => {
    const key = `new-${nextContactKey.current++}`;
    setValue((current) => ({
      ...current,
      contacts: [
        ...current.contacts,
        { ...blankContact(key), isPrimary: current.contacts.length === 0 },
      ],
    }));
  };

  const removeContact = (index: number) => {
    setValue((current) => {
      const contact = current.contacts[index];
      if (!contact || current.contacts.length === 1 || contact.isPrimary) return current;
      return { ...current, contacts: current.contacts.filter((_, position) => position !== index) };
    });
  };

  const moveContact = (index: number, direction: -1 | 1) => {
    setValue((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.contacts.length) return current;
      const contacts = [...current.contacts];
      [contacts[index], contacts[destination]] = [contacts[destination]!, contacts[index]!];
      return { ...current, contacts };
    });
  };

  const addService = () => {
    const service = serviceDraft.trim();
    if (!service) return;
    if (value.preferredServices.some((item) => item.toLowerCase() === service.toLowerCase())) {
      setFieldErrors((current) => ({
        ...current,
        preferredServices: ["That preferred service is already listed."],
      }));
      return;
    }
    setValue((current) => ({
      ...current,
      preferredServices: [...current.preferredServices, service],
    }));
    setServiceDraft("");
    setFieldErrors((current) => ({ ...current, preferredServices: [] }));
  };

  const removeService = (index: number) => {
    setValue((current) => ({
      ...current,
      preferredServices: current.preferredServices.filter((_, position) => position !== index),
    }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback(null);

    const input: ClientInput = {
      ...value,
      contacts: value.contacts.map(toContactInput),
    };
    const parsed = clientInputSchema.safeParse(input);
    if (!parsed.success) {
      setFieldErrors(validationErrors(parsed.error));
      setFeedback({
        status: "error",
        message: "Check the highlighted client details and try again.",
      });
      return;
    }

    setFieldErrors({});
    submitting.current = true;
    startTransition(async () => {
      try {
        const result =
          props.mode === "create"
            ? await createClient(parsed.data)
            : await updateClient(props.initialValue.id, parsed.data);
        if (result.status === "success") {
          router.push(`/ops/clients/${result.clientId}`);
          router.refresh();
          return;
        }
        if (result.status === "invalid") {
          setFieldErrors(result.fieldErrors);
          setFeedback({ status: "error", message: result.error });
          return;
        }
        if (result.status === "conflict") {
          setFeedback({
            status: "conflict",
            message: result.error,
            clientId: result.clientId,
          });
          return;
        }
        setFeedback({ status: "error", message: result.error });
      } catch {
        setFeedback({
          status: "error",
          message: "We couldn't save this client just now. Please try again.",
        });
      } finally {
        submitting.current = false;
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-5xl flex-col gap-8">
      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Client Profile</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Client name</span>
            <input
              value={value.name}
              onChange={(event) => setField("name", event.target.value)}
              aria-invalid={Boolean(fieldErrors.name?.length)}
              aria-describedby={fieldErrors.name?.length ? "client-name-error" : undefined}
              className={inputClass}
              autoComplete="organization"
            />
            <FieldError id="client-name-error" messages={fieldErrors.name} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Client type</span>
            <select
              value={value.type}
              onChange={(event) => setField("type", event.target.value as ClientInput["type"])}
              className={inputClass}
            >
              {CLIENT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Relationship status</span>
            <select
              value={value.status}
              onChange={(event) => setField("status", event.target.value as ClientInput["status"])}
              className={inputClass}
            >
              {CLIENT_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Account tier</span>
            <select
              value={value.accountTier}
              onChange={(event) =>
                setField("accountTier", event.target.value as ClientInput["accountTier"])
              }
              className={inputClass}
            >
              {ACCOUNT_TIERS.map((tier) => (
                <option key={tier}>{tier}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Client since</span>
            <input
              type="date"
              value={value.clientSince}
              onChange={(event) => setField("clientSince", event.target.value)}
              aria-invalid={Boolean(fieldErrors.clientSince?.length)}
              aria-describedby={fieldErrors.clientSince?.length ? "client-since-error" : undefined}
              className={inputClass}
            />
            <FieldError id="client-since-error" messages={fieldErrors.clientSince} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Industry</span>
            <input
              value={value.industry}
              onChange={(event) => setField("industry", event.target.value)}
              aria-invalid={Boolean(fieldErrors.industry?.length)}
              aria-describedby={fieldErrors.industry?.length ? "industry-error" : undefined}
              className={inputClass}
            />
            <FieldError id="industry-error" messages={fieldErrors.industry} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Region</span>
            <input
              value={value.region}
              onChange={(event) => setField("region", event.target.value)}
              aria-invalid={Boolean(fieldErrors.region?.length)}
              aria-describedby={fieldErrors.region?.length ? "region-error" : undefined}
              className={inputClass}
            />
            <FieldError id="region-error" messages={fieldErrors.region} />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Account overview</span>
            <textarea
              value={value.accountOverview}
              onChange={(event) => setField("accountOverview", event.target.value)}
              aria-invalid={Boolean(fieldErrors.accountOverview?.length)}
              aria-describedby={
                fieldErrors.accountOverview?.length ? "account-overview-error" : undefined
              }
              className={textAreaClass}
              rows={4}
            />
            <FieldError id="account-overview-error" messages={fieldErrors.accountOverview} />
          </label>

          <div className="sm:col-span-2">
            <label htmlFor="preferred-service" className="text-sm font-medium">
              Preferred services
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="preferred-service"
                value={serviceDraft}
                onChange={(event) => setServiceDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addService();
                  }
                }}
                aria-invalid={Boolean(fieldErrors.preferredServices?.length)}
                aria-describedby={
                  fieldErrors.preferredServices?.length ? "preferred-services-error" : undefined
                }
                className={inputClass}
                placeholder="e.g. Photography"
              />
              <Button type="button" variant="secondary" onClick={addService}>
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>
            <FieldError id="preferred-services-error" messages={fieldErrors.preferredServices} />
            {value.preferredServices.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {value.preferredServices.map((service, index) => (
                  <li
                    key={`${service}-${index}`}
                    className="bg-line inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                  >
                    {service}
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      aria-label={`Remove ${service}`}
                      title={`Remove ${service}`}
                      className="hover:bg-line-strong inline-flex size-5 items-center justify-center"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Relationship notes</span>
            <textarea
              value={value.relationshipNotes}
              onChange={(event) => setField("relationshipNotes", event.target.value)}
              aria-invalid={Boolean(fieldErrors.relationshipNotes?.length)}
              aria-describedby={
                fieldErrors.relationshipNotes?.length ? "relationship-notes-error" : undefined
              }
              className={textAreaClass}
              rows={4}
            />
            <FieldError id="relationship-notes-error" messages={fieldErrors.relationshipNotes} />
          </label>
        </div>
      </section>

      <section className="border-line border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Contacts</h2>
            <p className="text-ink-muted mt-1 text-sm">Choose exactly one primary contact.</p>
          </div>
          <Button type="button" variant="secondary" onClick={addContact}>
            <Plus className="size-4" aria-hidden="true" />
            Add Contact
          </Button>
        </div>
        <FieldError id="contacts-error" messages={fieldErrors.contacts} />

        <div className="mt-5 flex flex-col gap-5">
          {value.contacts.map((contact, index) => {
            const prefix = `contacts.${index}`;
            const roleRequired = value.type === "Company";
            return (
              <fieldset key={contact.key} className="border-line bg-surface-soft border p-4">
                <legend className="px-1 text-sm font-medium">Contact {index + 1}</legend>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="primary-contact"
                      checked={contact.isPrimary}
                      onChange={() => setPrimary(index)}
                    />
                    Primary contact
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveContact(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move contact ${index + 1} up`}
                      title={`Move contact ${index + 1} up`}
                      className="hover:bg-line inline-flex size-8 items-center justify-center disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveContact(index, 1)}
                      disabled={index === value.contacts.length - 1}
                      aria-label={`Move contact ${index + 1} down`}
                      title={`Move contact ${index + 1} down`}
                      className="hover:bg-line inline-flex size-8 items-center justify-center disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      disabled={value.contacts.length === 1 || contact.isPrimary}
                      aria-label={`Remove contact ${index + 1}`}
                      title={
                        contact.isPrimary
                          ? "Choose another primary contact before removing this one"
                          : `Remove contact ${index + 1}`
                      }
                      className="hover:bg-line inline-flex size-8 items-center justify-center disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Full name</span>
                    <input
                      aria-label={`Contact ${index + 1} full name`}
                      value={contact.fullName}
                      onChange={(event) => setContact(index, { fullName: event.target.value })}
                      aria-invalid={Boolean(fieldErrors[`${prefix}.fullName`]?.length)}
                      aria-describedby={
                        fieldErrors[`${prefix}.fullName`]?.length
                          ? `${prefix}-full-name-error`
                          : undefined
                      }
                      className={inputClass}
                      autoComplete="name"
                    />
                    <FieldError
                      id={`${prefix}-full-name-error`}
                      messages={fieldErrors[`${prefix}.fullName`]}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">
                      Role / title{roleRequired ? " (required)" : " (optional)"}
                    </span>
                    <input
                      aria-label={`Contact ${index + 1} role or title`}
                      value={contact.roleTitle}
                      onChange={(event) => setContact(index, { roleTitle: event.target.value })}
                      aria-invalid={Boolean(fieldErrors[`${prefix}.roleTitle`]?.length)}
                      aria-describedby={
                        fieldErrors[`${prefix}.roleTitle`]?.length
                          ? `${prefix}-role-title-error`
                          : undefined
                      }
                      className={inputClass}
                      autoComplete="organization-title"
                    />
                    <FieldError
                      id={`${prefix}-role-title-error`}
                      messages={fieldErrors[`${prefix}.roleTitle`]}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Email</span>
                    <input
                      type="email"
                      aria-label={`Contact ${index + 1} email`}
                      value={contact.email}
                      onChange={(event) => setContact(index, { email: event.target.value })}
                      aria-invalid={Boolean(fieldErrors[`${prefix}.email`]?.length)}
                      aria-describedby={
                        fieldErrors[`${prefix}.email`]?.length ? `${prefix}-email-error` : undefined
                      }
                      className={inputClass}
                      autoComplete="email"
                    />
                    <FieldError
                      id={`${prefix}-email-error`}
                      messages={fieldErrors[`${prefix}.email`]}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Phone (optional)</span>
                    <input
                      type="tel"
                      aria-label={`Contact ${index + 1} phone`}
                      value={contact.phone}
                      onChange={(event) => setContact(index, { phone: event.target.value })}
                      aria-invalid={Boolean(fieldErrors[`${prefix}.phone`]?.length)}
                      aria-describedby={
                        fieldErrors[`${prefix}.phone`]?.length ? `${prefix}-phone-error` : undefined
                      }
                      className={inputClass}
                      autoComplete="tel"
                    />
                    <FieldError
                      id={`${prefix}-phone-error`}
                      messages={fieldErrors[`${prefix}.phone`]}
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      {feedback ? (
        <p
          ref={feedbackRef}
          role="alert"
          tabIndex={-1}
          className="border-line-strong border p-4 text-sm"
        >
          {feedback.message}{" "}
          {feedback.status === "conflict" ? (
            <Link href={`/ops/clients/${feedback.clientId}`} className="font-medium underline">
              View existing client
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : props.mode === "create" ? "Create Client" : "Save Changes"}
        </Button>
        <Link
          href={props.mode === "edit" ? `/ops/clients/${props.initialValue.id}` : "/ops/clients"}
          className="border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center border bg-white px-4 text-sm font-medium transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
