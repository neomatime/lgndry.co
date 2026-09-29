import { z } from "zod";
import { ACCOUNT_TIERS, CLIENT_STATUSES, CLIENT_TYPES } from "@/features/clients/types";

const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");

export const clientContactSchema = z.object({
  id: z.uuid().optional(),
  fullName: required(160),
  roleTitle: optional(160),
  email: z.string().trim().max(254).pipe(z.email()),
  phone: optional(50),
  isPrimary: z.boolean(),
});

export const clientInputSchema = z
  .object({
    name: required(200),
    type: z.enum(CLIENT_TYPES),
    status: z.enum(CLIENT_STATUSES),
    accountTier: z.enum(ACCOUNT_TIERS),
    industry: optional(160),
    region: optional(160),
    clientSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
    accountOverview: optional(4000),
    preferredServices: z.array(z.string().trim().min(1).max(120)).max(20),
    relationshipNotes: optional(4000),
    contacts: z.array(clientContactSchema).min(1).max(20),
  })
  .superRefine((value, context) => {
    if (value.contacts.filter((contact) => contact.isPrimary).length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["contacts"],
        message: "Choose exactly one primary contact.",
      });
    }

    const emails = new Set<string>();
    value.contacts.forEach((contact, index) => {
      const normalized = contact.email.trim().toLowerCase();
      if (emails.has(normalized)) {
        context.addIssue({
          code: "custom",
          path: ["contacts", index, "email"],
          message: "Each contact must use a different email address.",
        });
      }
      emails.add(normalized);
      if (value.type === "Company" && !contact.roleTitle.trim()) {
        context.addIssue({
          code: "custom",
          path: ["contacts", index, "roleTitle"],
          message: "Role or title is required for company contacts.",
        });
      }
    });
  })
  .transform((value) => {
    const seen = new Set<string>();
    return {
      ...value,
      preferredServices: value.preferredServices.filter((service) => {
        const key = service.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  });

export type ParsedClientInput = z.infer<typeof clientInputSchema>;
