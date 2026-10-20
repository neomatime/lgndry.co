import { z } from "zod";

const required = (max: number) => z.string().trim().min(1, "This field is required.").max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email("Enter a valid email address."))
  .transform((value) => value.toLowerCase());

const website = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a complete http or https URL.");

const percentage = z
  .number({ error: "Enter a valid percentage." })
  .finite()
  .positive("The retainer must be greater than 0%.")
  .max(100, "The retainer cannot exceed 100%.")
  .refine((value) => Number.isInteger(value * 100), "Use no more than two decimal places.");

const days = z
  .number({ error: "Enter a valid number of days." })
  .int("Use a whole number of days.")
  .min(1, "Use at least 1 day.")
  .max(365, "Use no more than 365 days.");

export const opsSettingsInputSchema = z.object({
  workspaceName: required(160),
  companyEmail: email,
  companyPhone: optional(50),
  websiteUrl: website,
  businessAddress: optional(2000),
  registrationNumber: optional(120),
  defaultQuoteTerms: optional(10000),
  defaultRetainerPercentage: percentage,
  defaultQuoteValidityDays: days,
  defaultDepositDueDays: days,
  bankName: optional(160),
  accountHolder: optional(160),
  accountNumber: optional(80),
  branchCode: optional(40),
  accountType: optional(80),
  paymentReferenceInstructions: optional(1000),
  senderName: required(160),
  senderEmail: email,
  replyToEmail: email,
});

export type ParsedOpsSettingsInput = z.infer<typeof opsSettingsInputSchema>;
