import { z } from "zod";
import {
  FOLLOW_UP_CONTACT_METHODS,
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_TYPES,
  RECURRENCE_FREQUENCIES,
} from "@/features/follow-ups/types";

const required = (max: number) => z.string().trim().min(1, "This field is required.").max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const optionalUuid = z.union([z.literal(""), z.uuid()]).default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");
const optionalDate = z.union([z.literal(""), date]).default("");
const optionalTime = z
  .string()
  .trim()
  .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Choose a valid time.")
  .default("");

export const followUpChecklistSchema = z.object({
  id: z.uuid().optional(),
  label: required(200),
  sortOrder: z.number().int().nonnegative(),
});

export const recurrenceSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    intervalCount: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    monthAnchor: z.number().int().min(1).max(31).nullable(),
    endsOn: optionalDate,
    maxOccurrences: z.number().int().min(2).max(500).nullable(),
  })
  .superRefine((value, context) => {
    if (!value.enabled) return;
    if (value.frequency === "Weekly" && value.weekdays.length === 0) {
      context.addIssue({ code: "custom", path: ["weekdays"], message: "Choose at least one day." });
    }
    if (value.frequency === "Monthly" && value.monthAnchor === null) {
      context.addIssue({
        code: "custom",
        path: ["monthAnchor"],
        message: "Choose a day of the month.",
      });
    }
  });

export const followUpInputSchema = z
  .object({
    clientId: z.uuid("Choose a client."),
    contactId: optionalUuid,
    enquiryId: optionalUuid,
    projectId: optionalUuid,
    followUpType: z.enum(FOLLOW_UP_TYPES),
    customType: optional(120),
    title: required(240),
    overview: optional(3000),
    notes: optional(5000),
    dueDate: date,
    dueTime: optionalTime,
    priority: z.enum(FOLLOW_UP_PRIORITIES),
    contactMethods: z.array(z.enum(FOLLOW_UP_CONTACT_METHODS)).min(1, "Choose a contact method."),
    checklist: z.array(followUpChecklistSchema).max(50),
    recurrence: recurrenceSchema,
    editScope: z.enum(["occurrence", "future"]),
  })
  .superRefine((value, context) => {
    if (value.enquiryId && value.projectId) {
      context.addIssue({
        code: "custom",
        path: ["enquiryId"],
        message: "Link either an enquiry or a project.",
      });
    }
    if (value.followUpType === "Other" && !value.customType) {
      context.addIssue({
        code: "custom",
        path: ["customType"],
        message: "Name the follow-up type.",
      });
    }
    if (value.followUpType !== "Other" && value.customType) {
      context.addIssue({
        code: "custom",
        path: ["customType"],
        message: "Custom type is only used for Other.",
      });
    }
    if (
      value.recurrence.enabled &&
      value.recurrence.endsOn &&
      value.recurrence.endsOn < value.dueDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["recurrence", "endsOn"],
        message: "End date cannot be before the first due date.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    contactMethods: [...new Set(value.contactMethods)],
    checklist: value.checklist.map((item, index) => ({ ...item, sortOrder: index })),
    recurrence: { ...value.recurrence, weekdays: [...new Set(value.recurrence.weekdays)].sort() },
  }));

export const completeFollowUpSchema = z.object({ outcome: optional(3000) });
export const cancelFollowUpSchema = z.object({
  reason: required(1000),
  scope: z.enum(["occurrence", "series"]),
});
// Rescheduling is occurrence-only: the backend's "future" reschedule path only
// moves the series' time (never its date pattern) and is deliberately not
// exposed. The field stays so the action's RPC payload shape is unchanged.
export const rescheduleFollowUpSchema = z.object({
  dueDate: date,
  dueTime: optionalTime,
  scope: z.enum(["occurrence"]),
});

export type ParsedFollowUpInput = z.infer<typeof followUpInputSchema>;
