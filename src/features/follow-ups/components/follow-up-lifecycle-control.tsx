"use client";

import { Ban, CalendarClock, CircleCheck, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelFollowUp,
  completeFollowUp,
  reopenFollowUp,
  rescheduleFollowUp,
} from "@/features/follow-ups/actions";
import { formatDueFull } from "@/features/follow-ups/due-label";
import {
  cancelFollowUpSchema,
  completeFollowUpSchema,
  rescheduleFollowUpSchema,
} from "@/features/follow-ups/schemas";
import type { FollowUpActionState, FollowUpDetail } from "@/features/follow-ups/types";

/** What the page shows after a lifecycle action succeeds. */
export type LifecycleNotice = { message: string; successorId?: string | null };

type Kind = "complete" | "reschedule" | "cancel" | "reopen";
type SuccessState = Extract<FollowUpActionState, { status: "success" }>;
type Problem = {
  kind: "invalid" | "conflict" | "not-found" | "error";
  message: string;
  successorId?: string;
};
type FieldErrors = Record<string, string[]>;

const FAILED = "We couldn't complete that just now. Please try again.";
const inputClass = "border-line-strong h-10 w-full border bg-white px-3 text-sm";
const textareaClass =
  "border-line-strong min-h-24 w-full resize-y border bg-white px-3 py-2 text-sm";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * A modal on the native `<dialog>` element: the browser makes the rest of the page inert and
 * handles the top layer. On top of that this adds what the platform leaves loose - initial focus
 * on the first field, Tab wrapping inside the dialog, Escape that is ignored while a save is in
 * flight (so a request can't be orphaned), and focus handed back to the control that opened it.
 */
function ModalDialog({
  title,
  description,
  titleId,
  descriptionId,
  closable,
  onClose,
  returnFocusTo,
  children,
}: {
  title: string;
  description: React.ReactNode;
  titleId: string;
  descriptionId: string;
  closable: boolean;
  onClose: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    const first =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const target = returnFocusTo;
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      const trigger = target.current;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [returnFocusTo]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (closable) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={onKeyDown}
      // The browser's own close request (Escape on some platforms, Android back) lands here.
      onCancel={(event) => {
        event.preventDefault();
        if (closable) onClose();
      }}
      className="border-line-strong text-ink m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-x-hidden overflow-y-auto border bg-white p-0 backdrop:bg-black/40"
    >
      <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-medium break-words">
            {title}
          </h2>
          <div id={descriptionId} className="text-ink-muted mt-1.5 text-sm break-words">
            {description}
          </div>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Field({
  id,
  label,
  hint,
  errors,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-ink-muted mt-0.5 text-xs">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {errors?.length ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, hint: boolean, errors?: string[]) =>
  [hint ? `${id}-hint` : "", errors?.length ? `${id}-error` : ""].filter(Boolean).join(" ") ||
  undefined;

/** Runs one lifecycle call and maps every possible result onto dialog state. */
function useLifecycleSubmit(onSuccess: (result: SuccessState) => void) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const busy = useRef(false);

  async function run(call: () => Promise<FollowUpActionState>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setProblem(null);
    setFieldErrors({});
    try {
      const result = await call();
      if (result.status === "success") {
        onSuccess(result);
        return;
      }
      if (result.status === "invalid") {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setProblem({ kind: "invalid", message: result.message });
      } else if (result.status === "conflict") {
        setProblem({ kind: "conflict", message: result.message, successorId: result.successorId });
      } else if (result.status === "not-found" || result.status === "error") {
        setProblem({ kind: result.status, message: result.message });
      } else {
        setProblem({ kind: "error", message: FAILED });
      }
    } catch {
      setProblem({ kind: "error", message: FAILED });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { pending, problem, fieldErrors, setFieldErrors, setProblem, run };
}

function ProblemMessage({
  problem,
  onRefresh,
}: {
  problem: Problem | null;
  onRefresh: () => void;
}) {
  if (!problem) return null;
  return (
    <div
      role="alert"
      className="border-line-strong flex min-w-0 flex-col gap-2 border p-3 text-sm break-words"
    >
      <p>{problem.message}</p>
      {problem.kind === "conflict" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="font-medium underline" onClick={onRefresh}>
            Refresh follow-up
          </button>
          {problem.successorId ? (
            <Link href={`/ops/follow-ups/${problem.successorId}`} className="font-medium underline">
              View next occurrence
            </Link>
          ) : null}
        </div>
      ) : null}
      {problem.kind === "not-found" ? (
        <Link href="/ops/follow-ups" className="font-medium underline">
          Back to Follow-ups
        </Link>
      ) : null}
    </div>
  );
}

function Actions({
  pending,
  onClose,
  closeLabel = "Close",
  submitLabel,
  pendingLabel,
}: {
  pending: boolean;
  onClose: () => void;
  closeLabel?: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
        {closeLabel}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}

type DialogProps = {
  followUp: FollowUpDetail;
  returnFocusTo: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Re-fetches the page's data (used by the conflict message). */
  onRefresh: () => void;
  onDone: (notice: LifecycleNotice) => void;
};

function CompleteDialog({ followUp, returnFocusTo, onClose, onRefresh, onDone }: DialogProps) {
  const ids = useId();
  const [outcome, setOutcome] = useState("");
  const outstanding = followUp.checklist.filter((item) => !item.isCompleted).length;
  const repeating = followUp.series?.active === true;
  const submit = useLifecycleSubmit((result) => {
    onDone({
      message: result.successorId
        ? "Follow-up marked complete. The next occurrence has been created."
        : repeating
          ? "Follow-up marked complete. That was the last occurrence, so the series has ended."
          : "Follow-up marked complete.",
      successorId: result.successorId,
    });
  });
  const outcomeId = `${ids}-outcome`;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = completeFollowUpSchema.safeParse({ outcome });
    if (!parsed.success) {
      submit.setFieldErrors({ outcome: ["Keep the outcome under 3000 characters."] });
      return;
    }
    void submit.run(() => completeFollowUp(followUp.id, followUp.version, parsed.data));
  }

  return (
    <ModalDialog
      title="Mark follow-up complete"
      titleId={`${ids}-title`}
      descriptionId={`${ids}-description`}
      closable={!submit.pending}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      description={
        <>
          <p>Completing &ldquo;{followUp.title}&rdquo; moves it out of the open queue.</p>
          {outstanding > 0 ? (
            <p className="text-ink mt-2 flex items-start gap-2 font-medium">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {plural(outstanding, "checklist item is", "checklist items are")} not done yet. You
                can still complete this follow-up.
              </span>
            </p>
          ) : null}
          {repeating ? (
            <p className="mt-2">
              This follow-up repeats. Completing it creates the next occurrence while the series is
              still running.
            </p>
          ) : null}
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-4">
        <Field
          id={outcomeId}
          label="Outcome (optional)"
          hint="What happened, or what was agreed."
          errors={submit.fieldErrors.outcome}
        >
          <textarea
            id={outcomeId}
            data-autofocus
            rows={4}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            aria-invalid={submit.fieldErrors.outcome?.length ? true : undefined}
            aria-describedby={describedBy(outcomeId, true, submit.fieldErrors.outcome)}
            className={textareaClass}
          />
        </Field>
        <ProblemMessage problem={submit.problem} onRefresh={onRefresh} />
        <Actions
          pending={submit.pending}
          onClose={onClose}
          submitLabel="Complete Follow-up"
          pendingLabel="Completing..."
        />
      </form>
    </ModalDialog>
  );
}

function RescheduleDialog({ followUp, returnFocusTo, onClose, onRefresh, onDone }: DialogProps) {
  const ids = useId();
  const [dueDate, setDueDate] = useState(followUp.dueDate);
  const [dueTime, setDueTime] = useState(followUp.dueTime);
  const repeating = followUp.series?.active === true;
  const submit = useLifecycleSubmit(() => {
    onDone({ message: `Follow-up rescheduled to ${formatDueFull(dueDate, dueTime)}.` });
  });
  const dateId = `${ids}-date`;
  const timeId = `${ids}-time`;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Occurrence-only by design: a series' repeat pattern is changed through Edit.
    const parsed = rescheduleFollowUpSchema.safeParse({ dueDate, dueTime, scope: "occurrence" });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "dueDate");
        (errors[key] ??= []).push(
          key === "dueDate" ? "Choose the new due date." : "Choose a valid time.",
        );
      }
      submit.setFieldErrors(errors);
      return;
    }
    if (parsed.data.dueDate === followUp.dueDate && parsed.data.dueTime === followUp.dueTime) {
      submit.setFieldErrors({ dueDate: ["Choose a different date or time."] });
      return;
    }
    void submit.run(() => rescheduleFollowUp(followUp.id, followUp.version, parsed.data));
  }

  return (
    <ModalDialog
      title="Reschedule follow-up"
      titleId={`${ids}-title`}
      descriptionId={`${ids}-description`}
      closable={!submit.pending}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      description={
        <>
          <p>Currently due {formatDueFull(followUp.dueDate, followUp.dueTime)}.</p>
          {repeating ? (
            <p className="mt-1">
              This moves only this occurrence. To change how the series repeats, use Edit Follow-up.
            </p>
          ) : null}
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={dateId} label="New due date" errors={submit.fieldErrors.dueDate}>
            <input
              id={dateId}
              data-autofocus
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-invalid={submit.fieldErrors.dueDate?.length ? true : undefined}
              aria-describedby={describedBy(dateId, false, submit.fieldErrors.dueDate)}
              className={inputClass}
            />
          </Field>
          <Field id={timeId} label="New due time (optional)" errors={submit.fieldErrors.dueTime}>
            <input
              id={timeId}
              type="time"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
              aria-invalid={submit.fieldErrors.dueTime?.length ? true : undefined}
              aria-describedby={describedBy(timeId, false, submit.fieldErrors.dueTime)}
              className={inputClass}
            />
          </Field>
        </div>
        <ProblemMessage problem={submit.problem} onRefresh={onRefresh} />
        <Actions
          pending={submit.pending}
          onClose={onClose}
          submitLabel="Save New Date"
          pendingLabel="Saving..."
        />
      </form>
    </ModalDialog>
  );
}

function CancelDialog({ followUp, returnFocusTo, onClose, onRefresh, onDone }: DialogProps) {
  const ids = useId();
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"occurrence" | "series">("occurrence");
  const repeating = followUp.series?.active === true;
  const submit = useLifecycleSubmit((result) => {
    if (!repeating) return onDone({ message: "Follow-up cancelled." });
    if (scope === "series")
      return onDone({ message: "Follow-up cancelled. The series has ended, so nothing repeats." });
    if (result.successorId)
      return onDone({
        message: "Follow-up cancelled. The next occurrence has been created.",
        successorId: result.successorId,
      });
    onDone({
      message: "Follow-up cancelled. That was the last occurrence, so the series has ended.",
    });
  });
  const reasonId = `${ids}-reason`;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = cancelFollowUpSchema.safeParse({
      reason,
      scope: repeating ? scope : "occurrence",
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "reason");
        (errors[key] ??= []).push(
          key === "reason"
            ? reason.trim()
              ? "Keep the reason under 1000 characters."
              : "Give a short reason for cancelling."
            : "Choose which occurrences to cancel.",
        );
      }
      submit.setFieldErrors(errors);
      return;
    }
    void submit.run(() => cancelFollowUp(followUp.id, followUp.version, parsed.data));
  }

  return (
    <ModalDialog
      title="Cancel follow-up"
      titleId={`${ids}-title`}
      descriptionId={`${ids}-description`}
      closable={!submit.pending}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      description={
        <p>
          &ldquo;{followUp.title}&rdquo; will be marked cancelled. A cancelled follow-up can be
          reopened later.
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-4">
        <Field id={reasonId} label="Reason for cancelling" errors={submit.fieldErrors.reason}>
          <textarea
            id={reasonId}
            data-autofocus
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-required="true"
            aria-invalid={submit.fieldErrors.reason?.length ? true : undefined}
            aria-describedby={describedBy(reasonId, false, submit.fieldErrors.reason)}
            className={textareaClass}
          />
        </Field>
        {repeating ? (
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-sm font-medium">Which occurrences should be cancelled?</legend>
            {(
              [
                ["occurrence", "This occurrence only (skip it and continue the series)"],
                ["series", "This and future occurrences (end the series)"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`${ids}-scope`}
                  className="mt-0.5 size-4 shrink-0"
                  checked={scope === value}
                  onChange={() => setScope(value)}
                />
                <span className="min-w-0 break-words">{label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <ProblemMessage problem={submit.problem} onRefresh={onRefresh} />
        <Actions
          pending={submit.pending}
          onClose={onClose}
          closeLabel="Keep Follow-up"
          submitLabel="Confirm Cancellation"
          pendingLabel="Cancelling..."
        />
      </form>
    </ModalDialog>
  );
}

function ReopenDialog({ followUp, returnFocusTo, onClose, onRefresh, onDone }: DialogProps) {
  const ids = useId();
  const submit = useLifecycleSubmit(() => onDone({ message: "Follow-up reopened." }));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit.run(() => reopenFollowUp(followUp.id, followUp.version));
  }

  return (
    <ModalDialog
      title="Reopen follow-up"
      titleId={`${ids}-title`}
      descriptionId={`${ids}-description`}
      closable={!submit.pending}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      description={
        <p>
          &ldquo;{followUp.title}&rdquo; returns to Open. The saved outcome note or cancellation
          reason is cleared, and the History tab keeps a record that it happened.
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-4">
        <ProblemMessage problem={submit.problem} onRefresh={onRefresh} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submit.pending}>
            Close
          </Button>
          <Button type="submit" data-autofocus disabled={submit.pending}>
            {submit.pending ? "Reopening..." : "Reopen Follow-up"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}

export const REOPEN_BLOCKED_ID = "reopen-blocked";

/** A finished recurring occurrence whose successor exists can't be reopened: the series has
 * moved on, and reopening would leave two current actions in it. */
export function isReopenBlocked(followUp: Pick<FollowUpDetail, "status" | "successorId">) {
  return followUp.status !== "Open" && Boolean(followUp.successorId);
}

/** The explanation shown (by the page, in full width) when Reopen is not offered. */
export function ReopenBlockedNote({
  followUp,
}: {
  followUp: Pick<FollowUpDetail, "status" | "successorId">;
}) {
  if (!isReopenBlocked(followUp)) return null;
  return (
    <p id={REOPEN_BLOCKED_ID} className="text-ink-muted text-sm">
      This occurrence can&apos;t be reopened because its series has already moved on to the next
      one. Use the next occurrence instead.
    </p>
  );
}

/**
 * The follow-up's lifecycle buttons and their confirmation dialogs. Open work offers Mark
 * Complete, Reschedule and Cancel; finished work offers Reopen, except a recurring occurrence
 * whose successor already exists, which explains why and links to that successor instead.
 *
 * The version sent with every call is the one on the follow-up the page last rendered. After a
 * success the page data is refreshed in a transition, and the buttons stay disabled until that
 * refresh lands, so the next action never goes out with a stale version.
 */
export function FollowUpLifecycleControl({
  followUp,
  onDone,
}: {
  followUp: FollowUpDetail;
  onDone: (notice: LifecycleNotice) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const trigger = useRef<HTMLElement | null>(null);

  // Remember the clicked control: some browsers do not focus a button on click, so
  // `document.activeElement` can't be trusted to find it again later.
  function show(kind: Kind, event: React.MouseEvent<HTMLElement>) {
    trigger.current = event.currentTarget;
    setOpen(kind);
  }

  const refresh = () => {
    setOpen(null);
    startRefresh(() => router.refresh());
  };

  function finish(notice: LifecycleNotice) {
    setOpen(null);
    onDone(notice);
    startRefresh(() => router.refresh());
  }

  const dialogProps: DialogProps = {
    followUp,
    returnFocusTo: trigger,
    onClose: () => setOpen(null),
    onRefresh: refresh,
    onDone: finish,
  };

  return (
    <>
      {followUp.status === "Open" ? (
        <>
          <Button
            variant="secondary"
            onClick={(event) => show("reschedule", event)}
            disabled={refreshing}
          >
            <CalendarClock className="size-4" aria-hidden="true" />
            Reschedule
          </Button>
          <Button
            variant="secondary"
            onClick={(event) => show("cancel", event)}
            disabled={refreshing}
          >
            <Ban className="size-4" aria-hidden="true" />
            Cancel Follow-up
          </Button>
          <Button onClick={(event) => show("complete", event)} disabled={refreshing}>
            <CircleCheck className="size-4" aria-hidden="true" />
            Mark Complete
          </Button>
        </>
      ) : isReopenBlocked(followUp) ? (
        <Link
          href={`/ops/follow-ups/${followUp.successorId}`}
          aria-describedby={REOPEN_BLOCKED_ID}
          className="border-ink bg-ink inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium text-white transition-colors hover:bg-black"
        >
          View next occurrence
        </Link>
      ) : (
        <Button onClick={(event) => show("reopen", event)} disabled={refreshing}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reopen
        </Button>
      )}
      {open === "complete" ? <CompleteDialog {...dialogProps} /> : null}
      {open === "reschedule" ? <RescheduleDialog {...dialogProps} /> : null}
      {open === "cancel" ? <CancelDialog {...dialogProps} /> : null}
      {open === "reopen" ? <ReopenDialog {...dialogProps} /> : null}
    </>
  );
}
