import { z } from "zod";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");

export const enquiryEditSchema = z.object({
  fullName: required(120),
  company: optional(160),
  email: z.string().trim().max(254).pipe(z.email()),
  phone: required(40),
  projectType: z.enum(PROJECT_TYPES),
  location: required(200),
  timeline: required(200),
  description: required(2000),
  budget: optional(200),
});

export type EnquiryEditInput = z.infer<typeof enquiryEditSchema>;
