import { z } from "zod";

// Server-side validation for the Start a Project form. The browser already
// enforces required fields; this is the check that can't be bypassed.
// Limits are deliberately generous — they exist to stop abuse, not to
// police content.

const optional = (max: number) => z.string().trim().max(max).default("");
const required = (max: number) => z.string().trim().min(1).max(max);
const email = z.string().trim().max(254).pipe(z.email());

// Hidden field real visitors never see or fill; bots often do.
const honeypot = z.string().max(500).optional();

export const PROJECT_TYPES = [
  "Documentary",
  "Event",
  "Film",
  "Visual Production",
  "Other",
] as const;

export const projectEnquirySchema = z.object({
  full_name: required(120),
  company: optional(160),
  email,
  phone: required(40),
  project_type: z.enum(PROJECT_TYPES),
  location: required(200),
  timeline: required(200),
  description: required(2000),
  budget: optional(200),
  hp_website: honeypot,
});

export type ProjectEnquiryInput = z.infer<typeof projectEnquirySchema>;
