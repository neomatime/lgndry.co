import { z } from "zod";

// Server-side validation for the public forms. The browser already enforces
// required fields; this is the check that can't be bypassed. Limits are
// deliberately generous — they exist to stop abuse, not to police content.

const optional = (max: number) => z.string().trim().max(max).default("");
const required = (max: number) => z.string().trim().min(1).max(max);
const email = z.string().trim().max(254).pipe(z.email());

// Hidden field real visitors never see or fill; bots often do.
const honeypot = z.string().max(500).optional();

export const contactLeadSchema = z.object({
  assistance_needed: required(200),
  project_readiness: required(200),
  timeline: required(200),
  budget_range: required(200),
  message: required(2000),
  name: required(120),
  email,
  phone: required(40),
  company: optional(160),
  hp_website: honeypot,
});

const isoDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default("");

export const bookingSchema = z.object({
  session_type: required(200),
  services: required(600),
  project_details: required(500),
  preferred_date: isoDate,
  preferred_time: required(10),
  session_location: required(200),
  date_flexibility: required(200),
  client_name: required(120),
  client_email: email,
  client_phone: required(40),
  company: optional(160),
  budget: required(200),
  hp_website: honeypot,
});

export const partnershipSchema = z.object({
  partnership_type: required(200),
  focus: required(600),
  brand_goals: required(500),
  company: required(160),
  industry: required(160),
  brand_link: optional(300),
  brand_location: required(160),
  content_frequency: required(200),
  contact_name: required(120),
  contact_role: optional(120),
  contact_email: email,
  contact_phone: required(40),
  partner_budget: required(200),
  hp_website: honeypot,
});

export type ContactLeadInput = z.infer<typeof contactLeadSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type PartnershipInput = z.infer<typeof partnershipSchema>;
