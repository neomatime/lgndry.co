"use client";

import { useEffect, useRef, useState } from "react";
import { BUDGET_PLACEHOLDER, CONTACT_BUDGETS } from "@/content/budgets";
import { CONTACT_EMAIL } from "@/content/site";
import { Select } from "@/components/site/forms/select";
import { submitContactLead } from "@/features/lead-capture/actions";
import { cn } from "@/lib/utils/cn";

const ASSISTANCE = [
  "Book a photography session",
  "Plan a brand or campaign shoot",
  "Build an ongoing creative partnership",
  "Purchase or enquire about a fine art print",
  "Discuss creative direction or visual storytelling",
  "General enquiry",
] as const;

const READINESS = [
  "Ready to book now",
  "Need a proposal or estimate",
  "Still comparing options",
  "Early idea / exploring",
] as const;

const TIMELINE = [
  "Within 2 weeks",
  "This month",
  "Next 1-3 months",
  "Flexible / no fixed date",
] as const;

const STEPS = ["01 Project fit", "02 Contact details"] as const;

function Arrow() {
  return (
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
  );
}

/**
 * The contact page's two-step enquiry form: first what the project needs, then
 * how to reach the person. Each step is validated before moving on.
 */
export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<0 | 1>(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const movedRef = useRef(false);

  // After moving between steps, focus the first field of the new step.
  useEffect(() => {
    if (!movedRef.current) return;
    formRef.current
      ?.querySelector<HTMLElement>(
        `[data-contact-phase="${phase}"] input, [data-contact-phase="${phase}"] select, [data-contact-phase="${phase}"] textarea, [data-contact-phase="${phase}"] button`,
      )
      ?.focus();
  }, [phase]);

  // A sent form should be brought into view.
  useEffect(() => {
    if (status === "sent") formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [status]);

  const validatePhase = (index: 0 | 1) => {
    const fields = formRef.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(
      `[data-contact-phase="${index}"] input, [data-contact-phase="${index}"] select, [data-contact-phase="${index}"] textarea`,
    );
    for (const field of fields ?? []) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  };

  const goTo = (next: 0 | 1) => {
    movedRef.current = true;
    setPhase(next);
  };

  const submit = async () => {
    setStatus("sending");
    const form = new FormData(formRef.current ?? undefined);
    const values: Record<string, string> = {};
    for (const key of new Set(form.keys())) values[key] = String(form.get(key) ?? "");
    try {
      const result = await submitContactLead(values);
      setStatus(result.ok ? "sent" : "failed");
    } catch (error) {
      console.error("Contact form submission failed", error);
      setStatus("failed");
    }
  };

  if (status === "sent") {
    return (
      <form ref={formRef} className="contact-form" data-contact-form="">
        <div className="contact-form__section contact-form__section--success">
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
          <h3>Message sent</h3>
          <p>Thank you for reaching out. We will be in touch within 24 hours.</p>
        </div>
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      className="contact-form"
      autoComplete="on"
      noValidate
      data-contact-form=""
      onSubmit={(event) => {
        event.preventDefault();
        if (status === "sending" || !validatePhase(1)) return;
        void submit();
      }}
    >
      {/* Spam trap: invisible to people, tempting to bots. */}
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <div className="contact-form__steps" aria-label="Contact form progress">
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={cn("contact-form__step", index === phase && "contact-form__step--active")}
            data-contact-step={index}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className={cn("contact-form__phase", phase === 0 && "contact-form__phase--active")}
        data-contact-phase="0"
        hidden={phase !== 0}
      >
        <div className="contact-form__section">
          <span>Project fit</span>
          <p>Help us understand what kind of support you need before we ask for your details.</p>
        </div>
        <label className="contact-form__wide">
          <span>What do you need assistance with?</span>
          <Select name="assistance_needed" required options={ASSISTANCE} placeholder="Select one" />
        </label>
        <label>
          <span>How ready is the project?</span>
          <Select
            name="project_readiness"
            required
            options={READINESS}
            placeholder="Select readiness"
          />
        </label>
        <label>
          <span>Ideal timeline</span>
          <Select name="timeline" required options={TIMELINE} placeholder="Select timeline" />
        </label>
        <label className="contact-form__wide">
          <span>Estimated budget</span>
          <Select
            name="budget_range"
            required
            options={CONTACT_BUDGETS}
            placeholder={BUDGET_PLACEHOLDER}
          />
        </label>
        <label className="contact-form__wide">
          <span>Tell us what success looks like</span>
          <textarea name="message" rows={5} required></textarea>
        </label>
        <div className="contact-form__actions">
          <button
            className="contact-submit"
            type="button"
            onClick={() => {
              if (validatePhase(0)) goTo(1);
            }}
          >
            <span>Next: contact details</span>
            <Arrow />
          </button>
        </div>
      </div>

      <div
        className={cn("contact-form__phase", phase === 1 && "contact-form__phase--active")}
        data-contact-phase="1"
        hidden={phase !== 1}
      >
        <div className="contact-form__section">
          <span>Your details</span>
          <p>Share where we should send the next step if the project is a fit.</p>
        </div>
        <label>
          <span>Your name</span>
          <input type="text" name="name" autoComplete="name" required />
        </label>
        <label>
          <span>Email address</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          <span>Phone / WhatsApp</span>
          <input type="tel" name="phone" autoComplete="tel" required />
        </label>
        <label>
          <span>Company / brand</span>
          <input type="text" name="company" autoComplete="organization" placeholder="Optional" />
        </label>
        {status === "failed" ? (
          <p className="contact-form__error" data-contact-error="">
            Something went wrong sending your message. Please try again or email us directly at{" "}
            {CONTACT_EMAIL}.
          </p>
        ) : null}
        <div className="contact-form__actions contact-form__actions--split">
          <button className="contact-form__back" type="button" onClick={() => goTo(0)}>
            Back
          </button>
          <button className="contact-submit" type="submit" disabled={status === "sending"}>
            <span>{status === "sending" ? "Sending..." : "Send message"}</span>
            <Arrow />
          </button>
        </div>
      </div>
    </form>
  );
}
