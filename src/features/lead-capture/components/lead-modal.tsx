"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { LeadResult } from "@/features/lead-capture/actions";
import { cn } from "@/lib/utils/cn";

export type ReviewRow = readonly [label: string, value: string];

/** What each field step needs to know about the checkbox group on step 1. */
export type StepProps = {
  step: 0 | 1 | 2;
  groupInvalid: boolean;
  onGroupChange: () => void;
};

export type LeadModalConfig = {
  variant: "booking" | "partnership";
  titleId: string;
  closeLabel: string;
  brand: string;
  brandTag: string;
  /** Lines of the big statement in the side panel; rendered with <br> between. */
  statement: readonly string[];
  eyebrow: string;
  title: string;
  intro: string;
  stepsLabel: string;
  stepLabels: readonly [string, string, string, string];
  /** Footer heading/copy for each of the four steps. */
  footers: readonly (readonly [title: string, copy: string])[];
  submitLabel: string;
  /** Name of the checkbox group that needs at least one tick on step 1. */
  groupName: string;
  reviewTitle: string;
  reviewRows: (value: (name: string) => string, group: string[]) => ReviewRow[];
  confirmText: string;
  successTitle: string;
  successText: string;
  failureText: string;
  /** Renders the fields for step 0, 1 or 2. */
  Step: React.ComponentType<StepProps>;
  submit: (values: Record<string, string>) => Promise<LeadResult>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([data-honeypot]), select, [tabindex]:not([tabindex="-1"])';

const LAST = 3;

type Props = {
  config: LeadModalConfig;
  open: boolean;
  onClose: () => void;
  /** Bumped by the provider on every open so the form always starts fresh. */
  session: number;
};

export function LeadModal({ config, open, onClose, session }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  // Page scroll lock while open.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("booking-modal-lock");
    return () => document.body.classList.remove("booking-modal-lock");
  }, [open]);

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, session]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "booking-modal",
        config.variant === "partnership" && "booking-modal--partnership",
        open && "booking-modal--open",
      )}
      aria-hidden={!open}
      inert={!open}
      onKeyDown={onKeyDown}
    >
      <div className="booking-modal__backdrop" onClick={onClose} />
      <ModalBody key={session} config={config} onClose={onClose} dialogRef={dialogRef} />
    </div>
  );
}

function ModalBody({
  config,
  onClose,
  dialogRef,
}: {
  config: LeadModalConfig;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLElement | null>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [groupInvalid, setGroupInvalid] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const data = () => new FormData(formRef.current ?? undefined);
  const groupValues = () => data().getAll(config.groupName).map(String);

  const validateGroup = () => {
    const valid = groupValues().length > 0;
    setGroupInvalid(!valid);
    return valid;
  };

  const validateStep = (index: number) => {
    const panel = formRef.current?.querySelector(`[data-booking-panel="${index}"]`);
    if (!panel) return true;
    const fields = panel.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    if (index === 0 && !validateGroup()) {
      panel.querySelector<HTMLInputElement>(`input[name="${config.groupName}"]`)?.focus();
      return false;
    }
    return true;
  };

  const goTo = (target: number) => {
    const next = Math.max(0, Math.min(target, LAST));
    if (next === LAST) {
      const form = data();
      setReview(
        config.reviewRows(
          (name) => String(form.get(name) ?? ""),
          form.getAll(config.groupName).map(String),
        ),
      );
    }
    setStep(next);
    if (panelRef.current) panelRef.current.scrollTop = 0;
  };

  /** Validates every step before `target`; on the first failure, shows that step. */
  const validateUpTo = (target: number) => {
    for (let index = 0; index < target; index++) {
      if (!validateStep(index)) {
        goTo(index);
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    setStatus("sending");
    const form = data();
    const values: Record<string, string> = {};
    for (const key of new Set(form.keys())) {
      if (key === "confirm_details") continue;
      values[key] =
        key === config.groupName
          ? form.getAll(key).map(String).join(", ")
          : String(form.get(key) ?? "");
    }
    try {
      const result = await config.submit(values);
      setStatus(result.ok ? "sent" : "failed");
    } catch (error) {
      console.error("Lead submission failed", error);
      setStatus("failed");
    }
    if (panelRef.current) panelRef.current.scrollTop = 0;
  };

  const [footerTitle, footerCopy] = config.footers[step] ?? config.footers[0] ?? ["", ""];
  const isLast = step === LAST;
  const sent = status === "sent";

  return (
    <section
      ref={dialogRef}
      className="booking-modal__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={config.titleId}
      tabIndex={-1}
    >
      <button
        className="booking-modal__close"
        type="button"
        aria-label={config.closeLabel}
        onClick={onClose}
      >
        <span></span>
        <span></span>
      </button>

      <aside className="booking-modal__visual" aria-hidden="true">
        <div className="booking-modal__brand">
          <strong>{config.brand}</strong>
          <span>{config.brandTag}</span>
        </div>
        <div className="booking-modal__visual-copy">
          <p>
            {config.statement.map((line, index) => (
              <Fragment key={line}>
                {index > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </p>
          <span></span>
          <small>Step {step + 1} of 4</small>
        </div>
      </aside>

      <div ref={panelRef} className="booking-modal__panel">
        <div className="booking-modal__intro">
          <p className="booking-modal__eyebrow">{config.eyebrow}</p>
          <h2 id={config.titleId}>{config.title}</h2>
          <p>{config.intro}</p>
          <span className="booking-modal__rule" aria-hidden="true"></span>
        </div>

        <div className="booking-modal__content">
          <ol className="booking-modal__steps" aria-label={config.stepsLabel}>
            {config.stepLabels.map((label, index) => (
              <li
                key={label}
                className={cn(index === step && "is-active", index < step && "is-complete")}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (index <= step || validateUpTo(index)) goTo(index);
                  }}
                >
                  <span>{index + 1}</span>
                  <strong>{label}</strong>
                </button>
              </li>
            ))}
          </ol>

          <form
            ref={formRef}
            className="booking-modal__form"
            autoComplete="on"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (sent || status === "sending") return;
              if (!validateUpTo(LAST) || !validateStep(LAST)) return;
              void submit();
            }}
          >
            {/* Spam trap: invisible to people, tempting to bots. */}
            <input
              type="text"
              name="hp_website"
              data-honeypot=""
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />

            <div className="booking-modal__panels">
              {([0, 1, 2] as const).map((index) => (
                <fieldset
                  key={index}
                  className={cn("booking-modal__screen", index === step && "is-active")}
                  data-booking-panel={index}
                >
                  <config.Step
                    step={index}
                    groupInvalid={groupInvalid}
                    onGroupChange={validateGroup}
                  />
                </fieldset>
              ))}

              <fieldset
                className={cn("booking-modal__screen", isLast && "is-active")}
                data-booking-panel={LAST}
              >
                <div className="booking-modal__review">
                  {sent ? (
                    <div className="booking-modal__success">
                      <svg
                        className="form-success__icon"
                        width="48"
                        height="48"
                        viewBox="0 0 48 48"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" />
                        <path
                          d="M15 24.5L21 30.5L33 17.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <h3>{config.successTitle}</h3>
                      <p>{config.successText}</p>
                    </div>
                  ) : (
                    <>
                      <h3>{config.reviewTitle}</h3>
                      <dl>
                        {review.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {status === "failed" ? (
                        <p className="booking-modal__error is-visible" data-booking-submit-error="">
                          {config.failureText}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <label className="booking-modal__confirm">
                  <input type="checkbox" name="confirm_details" required />
                  <span>{config.confirmText}</span>
                </label>
              </fieldset>
            </div>

            <div className="booking-modal__footer">
              <p>
                <span aria-hidden="true">Cal</span>
                <strong>{footerTitle}</strong>
                <br />
                <em>{footerCopy}</em>
              </p>
              <div className="booking-modal__actions">
                <button
                  className="booking-modal__back"
                  type="button"
                  hidden={sent}
                  disabled={step === 0}
                  onClick={() => goTo(step - 1)}
                >
                  Back
                </button>
                <button
                  className="booking-modal__next"
                  type={isLast ? "submit" : "button"}
                  hidden={sent}
                  disabled={status === "sending"}
                  onClick={(event) => {
                    if (isLast) return;
                    event.preventDefault();
                    if (validateStep(step)) goTo(step + 1);
                  }}
                >
                  <span>
                    {status === "sending"
                      ? "Sending..."
                      : isLast
                        ? config.submitLabel
                        : "Next Step"}
                  </span>
                  <svg
                    width="40"
                    height="8"
                    viewBox="0 0 40 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
