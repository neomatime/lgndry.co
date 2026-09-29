import { z } from "zod";
import {
  DELIVERABLE_STATUSES,
  DELIVERY_STATUSES,
  PAYMENT_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from "@/features/projects/types";

const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const optionalDate = z
  .string()
  .trim()
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a valid date.")
  .default("");
const optionalMoney = z
  .string()
  .trim()
  .refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid amount.")
  .default("");

export const projectMilestoneSchema = z.object({
  id: z.uuid().optional(),
  title: required(200),
  description: optional(1000),
  dueDate: optionalDate,
  status: z.enum(["Pending", "Completed"]),
});

export const projectTaskSchema = z.object({
  id: z.uuid().optional(),
  title: required(200),
  dueDate: optionalDate,
  isCompleted: z.boolean(),
});

export const projectDeliverableSchema = z.object({
  id: z.uuid().optional(),
  title: required(200),
  dueDate: optionalDate,
  status: z.enum(DELIVERABLE_STATUSES),
});

export const projectInputSchema = z
  .object({
    name: required(200),
    clientId: z.uuid(),
    clientContactId: z.union([z.literal(""), z.uuid()]).default(""),
    projectType: z.enum(PROJECT_TYPES),
    services: z.array(required(120)).max(20),
    overview: optional(5000),
    location: optional(200),
    startDate: optionalDate,
    endDate: optionalDate,
    scheduleNotes: optional(2000),
    peopleResources: optional(3000),
    budgetMin: optionalMoney,
    budgetMax: optionalMoney,
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
    paymentStatus: z.enum(PAYMENT_STATUSES),
    deliveryStatus: z.enum(DELIVERY_STATUSES),
    status: z.enum(PROJECT_STATUSES),
    milestones: z.array(projectMilestoneSchema).max(100),
    tasks: z.array(projectTaskSchema).max(100),
    deliverables: z.array(projectDeliverableSchema).max(100),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before the start date.",
      });
    }
    if (value.budgetMin && value.budgetMax && Number(value.budgetMin) > Number(value.budgetMax)) {
      context.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "Maximum budget cannot be below the minimum budget.",
      });
    }
  })
  .transform((value) => {
    const seen = new Set<string>();
    return {
      ...value,
      services: value.services.filter((service) => {
        const key = service.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  });

export type ParsedProjectInput = z.infer<typeof projectInputSchema>;
