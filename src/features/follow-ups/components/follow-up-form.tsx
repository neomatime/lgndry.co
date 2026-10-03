"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createFollowUp, updateFollowUp } from "@/features/follow-ups/actions";
import { ChecklistEditor } from "@/features/follow-ups/components/checklist-editor";
import {
  BLANK_RECURRENCE,
  endModeOf,
  normalizeRecurrence,
  RecurrenceEditor,
  type EndMode,
} from "@/features/follow-ups/components/recurrence-editor";
import { followUpInputSchema } from "@/features/follow-ups/schemas";
import {
  FOLLOW_UP_CONTACT_METHODS,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_TYPES,
  type FollowUpClientOption,
  type FollowUpContactMethod,
  type FollowUpEditScope,
  type FollowUpInput,
} from "@/features/follow-ups/types";

type Props = {
  clients: FollowUpClientOption[];
  /** Present when editing; `version` powers conflict detection on save. */
  existingFollowUp?: { id: string; version: number; values: FollowUpInput };
  /** Pre-selection for contextual creation (already validated server-side). */
  defaultClientId?: string;
  defaultContactId?: string;
  defaultEnquiryId?: string;
  defaultProjectId?: string;
  /** Calm form-level note, e.g. "that link could not be used". */
  contextNotice?: string;
};

type Feedback = {
  kind: "invalid" | "conflict" | "not-found" | "error";
  message: string;
  successorId?: string;
};

const inputClass = "border-line-strong h-10 w-full border bg-white px-3 text-sm";
const textareaClass =
  "border-line-strong min-h-24 w-full resize-y border bg-white px-3 py-2 text-sm";
const sectionClass = "border-line border p-5 sm:p-6";
const FAILED = "We couldn't save this follow-up just now. Please try again.";

// Friendlier wording for the two numeric fields, whose default schema messages
// read like a validation library rather than guidance.
const FRIENDLY: Record<string, string> = {
  "recurrence.intervalCount": "Enter a whole number from 1 to 365.",
  "recurrence.maxOccurrences": "Enter a whole number from 2 to 500.",
};

function blank(defaults: {
  clientId: string;
  contactId: string;
  enquiryId: string;
  projectId: string;
}): FollowUpInput {
  return {
    ...defaults,
    followUpType: "Client Check-in",
    customType: "",
    title: "",
    overview: "",
    notes: "",
    dueDate: "",
    dueTime: "",
    priority: "Medium",
    contactMethods: [],
    checklist: [],
    recurrence: BLANK_RECURRENCE,
    editScope: "future",
  };
}

function tidy(errors: Record<string, string[]>) {
  const result: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const friendly = FRIENDLY[key];
    result[key] = friendly ? [friendly] : messages;
  }
  return result;
}

function errorsFor(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues)
    (errors[issue.path.map(String).join(".") || "form"] ??= []).push(issue.message);
  return tidy(errors);
}

function fieldA11y(id: string, messages?: string[]) {
  return messages?.length
    ? ({ "aria-invalid": true, "aria-describedby": `${id}-error` } as const)
    : {};
}

function ErrorText({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? (
    <p id={`${id}-error`} className="mt-1 text-xs font-medium">
      {messages.join(" ")}
    </p>
  ) : null;
}

/** Options for a select, plus a labelled stand-in for a saved value that is
 * no longer offered (for example an archived contact), so editing never
 * silently shows "None" while still submitting the old id. */
function withCurrent<T extends { id: string }>(
  options: T[],
  current: string,
  render: (option: T) => string,
  fallback: string,
) {
  const items = options.map((option) => ({ id: option.id, label: render(option) }));
  if (current && !items.some((item) => item.id === current))
    items.push({ id: current, label: fallback });
  return items;
}

export function FollowUpForm({
  clients,
  existingFollowUp,
  defaultClientId = "",
  defaultContactId = "",
  defaultEnquiryId = "",
  defaultProjectId = "",
  contextNotice,
}: Props) {
  const router = useRouter();
  const initial = existingFollowUp?.values;
  const [value, setValue] = useState<FollowUpInput>(
    () =>
      initial ??
      blank({
        clientId: defaultClientId,
        contactId: defaultContactId,
        enquiryId: defaultEnquiryId,
        projectId: defaultProjectId,
      }),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [endMode, setEndMode] = useState<EndMode>(() => endModeOf(value.recurrence));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const editing = Boolean(existingFollowUp);
  // An active series asks which occurrences an edit applies to.
  const asksScope = Boolean(initial?.recurrence.enabled);
  // Occurrence-only edits (and ended series' occurrences) can't change the rule.
  const recurrenceLocked = editing && value.editScope === "occurrence";

  const selectedClient = clients.find((client) => client.id === value.clientId);
  const setField = <K extends keyof FollowUpInput>(key: K, next: FollowUpInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  function chooseClient(clientId: string) {
    const client = clients.find((option) => option.id === clientId);
    setValue((current) => ({
      ...current,
      clientId,
      // Keep a related selection only if it also belongs to the new client.
      contactId: client?.contacts.some((item) => item.id === current.contactId)
        ? current.contactId
        : "",
      enquiryId: client?.enquiries.some((item) => item.id === current.enquiryId)
        ? current.enquiryId
        : "",
      projectId: client?.projects.some((item) => item.id === current.projectId)
        ? current.projectId
        : "",
    }));
  }

  function chooseScope(scope: FollowUpEditScope) {
    // The end-condition radios reset together with the rule they describe.
    if (scope === "occurrence" && initial) setEndMode(endModeOf(initial.recurrence));
    setValue((current) => ({
      ...current,
      editScope: scope,
      // Locking the rule discards any unsaved rule edits so the screen never
      // displays changes that won't be applied.
      recurrence: scope === "occurrence" && initial ? initial.recurrence : current.recurrence,
    }));
  }

  function toggleMethod(method: FollowUpContactMethod, checked: boolean) {
    setValue((current) => ({
      ...current,
      contactMethods: checked
        ? FOLLOW_UP_CONTACT_METHODS.filter(
            (item) => item === method || current.contactMethods.includes(item),
          )
        : current.contactMethods.filter((item) => item !== method),
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback(null);
    const candidate: FollowUpInput = {
      ...value,
      recurrence: recurrenceLocked ? value.recurrence : normalizeRecurrence(value.recurrence),
    };
    const parsed = followUpInputSchema.safeParse(candidate);
    const errors = parsed.success ? {} : errorsFor(parsed.error);
    // The schema reads "no end date" / "no count" as "never ends", so a chosen
    // end condition left empty would silently save the opposite of what was
    // picked. Catch it here, beside the control the user must fill in.
    if (!recurrenceLocked && candidate.recurrence.enabled) {
      if (endMode === "date" && !candidate.recurrence.endsOn)
        errors["recurrence.endsOn"] = ["Choose an end date, or select Never."];
      if (endMode === "count" && candidate.recurrence.maxOccurrences === null)
        errors["recurrence.maxOccurrences"] = [FRIENDLY["recurrence.maxOccurrences"]!];
    }
    if (!parsed.success || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFeedback({
        kind: "invalid",
        message: "Check the highlighted follow-up details and try again.",
      });
      return;
    }
    setFieldErrors({});
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = existingFollowUp
          ? await updateFollowUp(existingFollowUp.id, existingFollowUp.version, parsed.data)
          : await createFollowUp(parsed.data);
        if (result.status === "success") {
          router.push(`/ops/follow-ups/${result.followUpId}`);
          router.refresh();
          return;
        }
        if (result.status === "invalid" && result.fieldErrors)
          setFieldErrors(tidy(result.fieldErrors));
        if (result.status === "idle") {
          setFeedback({ kind: "error", message: FAILED });
          return;
        }
        setFeedback({
          kind: result.status,
          message: result.message,
          successorId: result.status === "conflict" ? result.successorId : undefined,
        });
      } catch {
        setFeedback({ kind: "error", message: FAILED });
      } finally {
        submitting.current = false;
      }
    });
  }

  const clientItems = withCurrent(
    clients,
    value.clientId,
    (client) => client.name,
    "Current client (no longer available)",
  );
  const contactItems = withCurrent(
    selectedClient?.contacts ?? [],
    value.contactId,
    (contact) => contact.fullName,
    "Current contact (no longer available)",
  );
  const enquiryItems = withCurrent(
    selectedClient?.enquiries ?? [],
    value.enquiryId,
    (enquiry) => enquiry.label,
    "Current enquiry (no longer available)",
  );
  const projectItems = withCurrent(
    selectedClient?.projects ?? [],
    value.projectId,
    (project) => project.label,
    "Current project (no longer available)",
  );

  const recurrenceErrors: Record<string, string[]> = {};
  const checklistErrors: Record<number, string[]> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (key.startsWith("recurrence.")) recurrenceErrors[key.slice("recurrence.".length)] = messages;
    const item = /^checklist\.(\d+)\./.exec(key);
    if (item) checklistErrors[Number(item[1])] = messages;
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-8">
      {contextNotice ? (
        <p role="status" className="border-line border p-4 text-sm">
          {contextNotice}
        </p>
      ) : null}

      <section aria-labelledby="fu-relationship" className={sectionClass}>
        <h2 id="fu-relationship" className="text-lg font-medium">
          Relationship
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-client" className="text-sm font-medium">
              Client
            </label>
            <select
              id="fu-client"
              value={value.clientId}
              onChange={(event) => chooseClient(event.target.value)}
              className={inputClass}
              {...fieldA11y("fu-client", fieldErrors.clientId)}
            >
              <option value="">Choose a client</option>
              {clientItems.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
            <ErrorText id="fu-client" messages={fieldErrors.clientId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-contact" className="text-sm font-medium">
              Contact
            </label>
            <select
              id="fu-contact"
              value={value.contactId}
              onChange={(event) => setField("contactId", event.target.value)}
              className={inputClass}
              {...fieldA11y("fu-contact", fieldErrors.contactId)}
            >
              <option value="">No selected contact</option>
              {contactItems.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.label}
                </option>
              ))}
            </select>
            <ErrorText id="fu-contact" messages={fieldErrors.contactId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-enquiry" className="text-sm font-medium">
              Related enquiry
            </label>
            <select
              id="fu-enquiry"
              value={value.enquiryId}
              disabled={Boolean(value.projectId)}
              onChange={(event) => setField("enquiryId", event.target.value)}
              className={inputClass}
              {...fieldA11y("fu-enquiry", fieldErrors.enquiryId)}
            >
              <option value="">No related enquiry</option>
              {enquiryItems.map((enquiry) => (
                <option key={enquiry.id} value={enquiry.id}>
                  {enquiry.label}
                </option>
              ))}
            </select>
            <ErrorText id="fu-enquiry" messages={fieldErrors.enquiryId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-project" className="text-sm font-medium">
              Related project
            </label>
            <select
              id="fu-project"
              value={value.projectId}
              disabled={Boolean(value.enquiryId)}
              onChange={(event) => setField("projectId", event.target.value)}
              className={inputClass}
              {...fieldA11y("fu-project", fieldErrors.projectId)}
            >
              <option value="">No related project</option>
              {projectItems.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
            <ErrorText id="fu-project" messages={fieldErrors.projectId} />
          </div>
          <p className="text-ink-muted text-xs sm:col-span-2">
            Only this client&apos;s contacts, enquiries and projects are listed. A follow-up can
            link to an enquiry or a project, not both.
          </p>
        </div>
      </section>

      <section aria-labelledby="fu-details" className={sectionClass}>
        <h2 id="fu-details" className="text-lg font-medium">
          Details
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-type" className="text-sm font-medium">
              Follow-up type
            </label>
            <select
              id="fu-type"
              value={value.followUpType}
              onChange={(event) =>
                setValue((current) => {
                  const followUpType = event.target.value as FollowUpInput["followUpType"];
                  return {
                    ...current,
                    followUpType,
                    // The custom label only exists for "Other".
                    customType: followUpType === "Other" ? current.customType : "",
                  };
                })
              }
              className={inputClass}
              {...fieldA11y("fu-type", fieldErrors.followUpType)}
            >
              {FOLLOW_UP_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <ErrorText id="fu-type" messages={fieldErrors.followUpType} />
          </div>
          {value.followUpType === "Other" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fu-custom-type" className="text-sm font-medium">
                Custom type
              </label>
              <input
                id="fu-custom-type"
                value={value.customType}
                onChange={(event) => setField("customType", event.target.value)}
                className={inputClass}
                {...fieldA11y("fu-custom-type", fieldErrors.customType)}
              />
              <ErrorText id="fu-custom-type" messages={fieldErrors.customType} />
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="fu-title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="fu-title"
              value={value.title}
              onChange={(event) => setField("title", event.target.value)}
              aria-describedby={
                fieldErrors.title?.length ? "fu-title-error fu-title-hint" : "fu-title-hint"
              }
              aria-invalid={fieldErrors.title?.length ? true : undefined}
              className={inputClass}
            />
            <p id="fu-title-hint" className="text-ink-muted text-xs">
              The next action, for example &ldquo;Chase deposit payment&rdquo;.
            </p>
            <ErrorText id="fu-title" messages={fieldErrors.title} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="fu-overview" className="text-sm font-medium">
              Overview
            </label>
            <textarea
              id="fu-overview"
              value={value.overview}
              onChange={(event) => setField("overview", event.target.value)}
              className={textareaClass}
              {...fieldA11y("fu-overview", fieldErrors.overview)}
            />
            <ErrorText id="fu-overview" messages={fieldErrors.overview} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="fu-notes" className="text-sm font-medium">
              Internal notes
            </label>
            <textarea
              id="fu-notes"
              value={value.notes}
              onChange={(event) => setField("notes", event.target.value)}
              className={textareaClass}
              {...fieldA11y("fu-notes", fieldErrors.notes)}
            />
            <ErrorText id="fu-notes" messages={fieldErrors.notes} />
          </div>
        </div>
      </section>

      <section aria-labelledby="fu-schedule" className={sectionClass}>
        <h2 id="fu-schedule" className="text-lg font-medium">
          Schedule
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-due-date" className="text-sm font-medium">
              Due date
            </label>
            <input
              id="fu-due-date"
              type="date"
              value={value.dueDate}
              onChange={(event) => setField("dueDate", event.target.value)}
              className={inputClass}
              {...fieldA11y("fu-due-date", fieldErrors.dueDate)}
            />
            <ErrorText id="fu-due-date" messages={fieldErrors.dueDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-due-time" className="text-sm font-medium">
              Due time (optional)
            </label>
            <input
              id="fu-due-time"
              type="time"
              value={value.dueTime}
              onChange={(event) => setField("dueTime", event.target.value)}
              className={inputClass}
              {...fieldA11y("fu-due-time", fieldErrors.dueTime)}
            />
            <ErrorText id="fu-due-time" messages={fieldErrors.dueTime} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fu-priority" className="text-sm font-medium">
              Priority
            </label>
            <select
              id="fu-priority"
              value={value.priority}
              onChange={(event) =>
                setField("priority", event.target.value as FollowUpInput["priority"])
              }
              className={inputClass}
              {...fieldA11y("fu-priority", fieldErrors.priority)}
            >
              {FOLLOW_UP_PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
            <ErrorText id="fu-priority" messages={fieldErrors.priority} />
          </div>
        </div>
        <fieldset
          className="mt-5"
          aria-describedby={fieldErrors.contactMethods?.length ? "fu-methods-error" : undefined}
        >
          <legend className="text-sm font-medium">Contact methods</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {FOLLOW_UP_CONTACT_METHODS.map((method) => (
              <label key={method} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.contactMethods.includes(method)}
                  onChange={(event) => toggleMethod(method, event.target.checked)}
                />
                {method}
              </label>
            ))}
          </div>
          <ErrorText id="fu-methods" messages={fieldErrors.contactMethods} />
        </fieldset>
      </section>

      <section aria-labelledby="fu-checklist" className={sectionClass}>
        <h2 id="fu-checklist" className="text-lg font-medium">
          Checklist
        </h2>
        <div className="mt-5">
          <ChecklistEditor
            items={value.checklist}
            onChange={(checklist) => setField("checklist", checklist)}
            itemErrors={checklistErrors}
            listErrors={fieldErrors.checklist}
          />
        </div>
      </section>

      <section aria-labelledby="fu-recurrence" className={sectionClass}>
        <h2 id="fu-recurrence" className="text-lg font-medium">
          Repeat
        </h2>
        {asksScope ? (
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">Apply changes to</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fu-edit-scope"
                  checked={value.editScope === "occurrence"}
                  onChange={() => chooseScope("occurrence")}
                />
                This occurrence only
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fu-edit-scope"
                  checked={value.editScope === "future"}
                  onChange={() => chooseScope("future")}
                />
                This and future occurrences
              </label>
            </div>
          </fieldset>
        ) : null}
        <div className="mt-5">
          <RecurrenceEditor
            value={value.recurrence}
            onChange={(recurrence) => setField("recurrence", recurrence)}
            endMode={endMode}
            onEndModeChange={setEndMode}
            dueDate={value.dueDate}
            disabled={recurrenceLocked}
            disabledReason={
              asksScope
                ? "Choose “This and future occurrences” to change how this follow-up repeats."
                : "This occurrence belongs to a series that has ended, so it can't repeat again."
            }
            errors={recurrenceErrors}
          />
        </div>
      </section>

      {feedback ? (
        <div
          ref={feedbackRef}
          role="alert"
          tabIndex={-1}
          className="border-line-strong flex flex-col gap-3 border p-4 text-sm"
        >
          <p>{feedback.message}</p>
          {feedback.kind === "conflict" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => router.refresh()}>
                Load latest version
              </Button>
              {feedback.successorId ? (
                <Link
                  href={`/ops/follow-ups/${feedback.successorId}`}
                  className="font-medium underline"
                >
                  Open the next occurrence
                </Link>
              ) : null}
              <span className="text-ink-muted text-xs">
                Loading the latest version replaces the changes you&apos;ve made here.
              </span>
            </div>
          ) : null}
          {feedback.kind === "not-found" ? (
            <Link href="/ops/follow-ups" className="font-medium underline">
              Back to follow-ups
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : editing ? "Save Changes" : "Create Follow-up"}
        </Button>
        <Link
          href={existingFollowUp ? `/ops/follow-ups/${existingFollowUp.id}` : "/ops/follow-ups"}
          className="border-line-strong hover:bg-surface-soft inline-flex h-10 items-center border bg-white px-4 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
