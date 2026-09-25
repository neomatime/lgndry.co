"use client";

import { BOOKING_BUDGETS, BUDGET_PLACEHOLDER } from "@/content/budgets";
import { CONTACT_EMAIL } from "@/content/site";
import { DatePicker } from "@/components/site/forms/date-picker";
import { Select } from "@/components/site/forms/select";
import { submitBooking } from "@/features/lead-capture/actions";
import type { LeadModalConfig, StepProps } from "@/features/lead-capture/components/lead-modal";
import {
  CheckboxGroup,
  CountedTextarea,
  Field,
} from "@/features/lead-capture/components/modal-fields";

const SESSION_TYPES = [
  "Portrait Session",
  "Commercial Photography",
  "Brand Campaign",
  "Fine Art / Creative Session",
  "Event Documentation",
] as const;

const SERVICES = [
  "Brand Photography",
  "Commercial Photography",
  "Portraiture",
  "Product Photography",
  "Interior & Architectural Photography",
  "Hospitality Photography",
  "Fine Art Photography",
] as const;

const FLEXIBILITY = [
  "Exact date only",
  "Flexible by a few days",
  "Flexible by a week or more",
] as const;

function BookingStep({ step, groupInvalid, onGroupChange }: StepProps) {
  if (step === 0) {
    return (
      <>
        <Field label="What type of session are you booking?" wide>
          <Select
            name="session_type"
            required
            options={SESSION_TYPES}
            placeholder="Select session type"
          />
        </Field>
        <CheckboxGroup
          legend="Select services"
          name="services"
          options={SERVICES}
          error="Select at least one service."
          invalid={groupInvalid}
          onChange={onGroupChange}
        />
        <Field label="Tell us about your project" wide>
          <CountedTextarea
            name="project_details"
            placeholder="Share a few details about your vision..."
          />
        </Field>
      </>
    );
  }

  if (step === 1) {
    return (
      <div className="booking-modal__grid">
        <Field label="Preferred date">
          <DatePicker name="preferred_date" />
        </Field>
        <Field label="Preferred time">
          <input type="time" name="preferred_time" required />
        </Field>
        <Field label="Where should the session happen?" wide>
          <input
            type="text"
            name="session_location"
            placeholder="Studio, venue, town, or online brief"
            required
          />
        </Field>
        <Field label="Date flexibility" wide>
          <Select
            name="date_flexibility"
            required
            options={FLEXIBILITY}
            placeholder="Select flexibility"
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="booking-modal__grid">
      <Field label="Your name">
        <input type="text" name="client_name" autoComplete="name" required />
      </Field>
      <Field label="Email address">
        <input type="email" name="client_email" autoComplete="email" required />
      </Field>
      <Field label="Phone / WhatsApp">
        <input type="tel" name="client_phone" autoComplete="tel" required />
      </Field>
      <Field label="Company / brand">
        <input type="text" name="company" autoComplete="organization" placeholder="Optional" />
      </Field>
      <Field label="Estimated budget" wide>
        <Select name="budget" required options={BOOKING_BUDGETS} placeholder={BUDGET_PLACEHOLDER} />
      </Field>
    </div>
  );
}

export const bookingConfig: LeadModalConfig = {
  variant: "booking",
  titleId: "bookingModalTitle",
  closeLabel: "Close booking form",
  brand: "LGNDRY.CO",
  brandTag: "Visual Storytelling",
  statement: ["Let's create", "something", "worth", "remembering."],
  eyebrow: "Book a Session",
  title: "Let's plan your session.",
  intro: "Fill in the details below and we'll get back to you within 24 hours.",
  stepsLabel: "Booking steps",
  stepLabels: ["Session Type", "Date & Time", "Your Details", "Review & Confirm"],
  footers: [
    ["Duration", "Typically 2 - 6 hours"],
    ["Scheduling", "Choose your preferred date"],
    ["Contact", "Tell us how to reach you"],
    ["Ready", "Review before sending"],
  ],
  submitLabel: "Send Request",
  groupName: "services",
  reviewTitle: "Review your booking",
  reviewRows: (value, group) => [
    ["Session type", value("session_type") || "-"],
    ["Services", group.length ? group.join(", ") : "-"],
    ["Project", value("project_details") || "-"],
    ["Date and time", `${value("preferred_date") || "-"} at ${value("preferred_time") || "-"}`],
    ["Location", value("session_location") || "-"],
    ["Flexibility", value("date_flexibility") || "-"],
    ["Name", value("client_name") || "-"],
    ["Email", value("client_email") || "-"],
    ["Phone", value("client_phone") || "-"],
    ["Company", value("company") || "Not provided"],
    ["Budget", value("budget") || "-"],
  ],
  confirmText:
    "I confirm these details are accurate and LGNDRY.Co may contact me about this booking.",
  successTitle: "Request sent",
  successText:
    "Thank you — your booking enquiry has been sent to LGNDRY.Co. We will be in touch within 24 hours.",
  failureText: `Something went wrong sending your request. Please try again or email us directly at ${CONTACT_EMAIL}.`,
  Step: BookingStep,
  submit: submitBooking,
};
