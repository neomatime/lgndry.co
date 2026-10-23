import { z } from "zod";

const optional = (max: number) => z.string().trim().max(max).default("");
const required = (max: number) => z.string().trim().min(1).max(max);

export const bookingEditSchema = z.object({
  service: required(200),
  services: z.array(required(120)).min(1).max(20),
  date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  start: optional(20),
  location: optional(200),
  projectDetails: optional(500),
  dateFlexibility: optional(200),
  budgetRange: optional(200),
  version: z.number().int().positive(),
});

export const partnershipEditSchema = z.object({
  partnershipType: required(200),
  focusAreas: z.array(required(120)).min(1).max(20),
  brandGoals: optional(500),
  industry: optional(160),
  brandLink: optional(300),
  brandLocation: optional(160),
  contentFrequency: optional(200),
  budgetRange: optional(200),
  version: z.number().int().positive(),
});
