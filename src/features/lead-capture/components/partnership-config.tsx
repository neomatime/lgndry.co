"use client";

import { BUDGET_PLACEHOLDER, PARTNERSHIP_BUDGETS } from "@/content/budgets";
import { CONTACT_EMAIL } from "@/content/site";
import { Select } from "@/components/site/forms/select";
import { submitPartnership } from "@/features/lead-capture/actions";
import type { LeadModalConfig, StepProps } from "@/features/lead-capture/components/lead-modal";
import {
  CheckboxGroup,
  CountedTextarea,
  Field,
} from "@/features/lead-capture/components/modal-fields";

const PARTNERSHIP_TYPES = [
  "Creative Partnership",
  "Visual Content Partnership",
  "Campaign Production",
  "Dedicated Visual Partner",
  "Not sure yet",
] as const;

const FOCUS_AREAS = [
  "Ongoing Photography",
  "Social & Content Creation",
  "Campaign Production",
  "Creative Direction",
  "Brand Storytelling",
  "Product & Lifestyle",
] as const;

const FREQUENCIES = ["Monthly", "Quarterly", "Per campaign", "One-off to start"] as const;

function PartnershipStep({ step, groupInvalid, onGroupChange }: StepProps) {
  if (step === 0) {
    return (
      <>
        <Field label="What kind of partnership are you exploring?" wide>
          <Select
            name="partnership_type"
            required
            options={PARTNERSHIP_TYPES}
            placeholder="Select partnership type"
          />
        </Field>
        <CheckboxGroup
          legend="What do you need?"
          name="focus"
          options={FOCUS_AREAS}
          error="Select at least one focus area."
          invalid={groupInvalid}
          onChange={onGroupChange}
        />
        <Field label="Tell us about your brand and goals" wide>
          <CountedTextarea
            name="brand_goals"
            placeholder="Who you are, what you make, and what you're hoping to build together..."
          />
        </Field>
      </>
    );
  }

  if (step === 1) {
    return (
      <div className="booking-modal__grid">
        <Field label="Company / brand name">
          <input type="text" name="company" autoComplete="organization" required />
        </Field>
        <Field label="Industry">
          <input
            type="text"
            name="industry"
            placeholder="e.g. Hospitality, Fashion, Property"
            required
          />
        </Field>
        <Field label="Website or Instagram">
          <input type="text" name="brand_link" placeholder="Optional" />
        </Field>
        <Field label="Location">
          <input type="text" name="brand_location" placeholder="City / country" required />
        </Field>
        <Field label="How often do you need content?" wide>
          <Select
            name="content_frequency"
            required
            options={FREQUENCIES}
            placeholder="Select frequency"
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="booking-modal__grid">
      <Field label="Your name">
        <input type="text" name="contact_name" autoComplete="name" required />
      </Field>
      <Field label="Your role">
        <input type="text" name="contact_role" placeholder="Optional" />
      </Field>
      <Field label="Email address">
        <input type="email" name="contact_email" autoComplete="email" required />
      </Field>
      <Field label="Phone / WhatsApp">
        <input type="tel" name="contact_phone" autoComplete="tel" required />
      </Field>
      <Field label="Estimated monthly budget" wide>
        <Select
          name="partner_budget"
          required
          options={PARTNERSHIP_BUDGETS}
          placeholder={BUDGET_PLACEHOLDER}
        />
      </Field>
    </div>
  );
}

export const partnershipConfig: LeadModalConfig = {
  variant: "partnership",
  titleId: "partnershipModalTitle",
  closeLabel: "Close partnership form",
  brand: "LGNDRY.CO",
  brandTag: "Brand Partnerships",
  statement: ["Let's build", "something", "that", "lasts."],
  eyebrow: "Brand Partnership",
  title: "Let's build a partnership.",
  intro: "Tell us about your brand and we'll be in touch within 48 hours.",
  stepsLabel: "Application steps",
  stepLabels: ["Partnership", "Your Brand", "Your Details", "Review & Confirm"],
  footers: [
    ["Partnership", "Ongoing visual content partnerships"],
    ["Your brand", "Tell us who you are"],
    ["Contact", "How we'll reach you"],
    ["Ready", "Review before sending"],
  ],
  submitLabel: "Send Application",
  groupName: "focus",
  reviewTitle: "Review your application",
  reviewRows: (value, group) => [
    ["Partnership type", value("partnership_type") || "-"],
    ["Focus areas", group.length ? group.join(", ") : "-"],
    ["Goals", value("brand_goals") || "-"],
    ["Company", value("company") || "-"],
    ["Industry", value("industry") || "-"],
    ["Website", value("brand_link") || "Not provided"],
    ["Location", value("brand_location") || "-"],
    ["Frequency", value("content_frequency") || "-"],
    ["Name", value("contact_name") || "-"],
    ["Role", value("contact_role") || "Not provided"],
    ["Email", value("contact_email") || "-"],
    ["Phone", value("contact_phone") || "-"],
    ["Budget", value("partner_budget") || "-"],
  ],
  confirmText:
    "I confirm these details are accurate and LGNDRY.Co may contact me about this partnership.",
  successTitle: "Application sent",
  successText:
    "Thank you — your partnership application has been sent to LGNDRY.Co. We will be in touch within 48 hours.",
  failureText: `Something went wrong sending your application. Please try again or email us directly at ${CONTACT_EMAIL}.`,
  Step: PartnershipStep,
  submit: submitPartnership,
};
