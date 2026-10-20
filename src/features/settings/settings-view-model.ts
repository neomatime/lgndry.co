import { z } from "zod";
import {
  OPS_CURRENCY,
  OPS_SETTINGS_ID,
  OPS_TIME_ZONE,
  type OpsSettings,
  type OpsSettingsInput,
} from "@/features/settings/types";

export const opsSettingsRecordSchema = z.object({
  id: z.literal(OPS_SETTINGS_ID),
  workspace_name: z.string(),
  company_email: z.string(),
  company_phone: z.string().nullable(),
  website_url: z.string().nullable(),
  business_address: z.string().nullable(),
  registration_number: z.string().nullable(),
  time_zone: z.literal(OPS_TIME_ZONE),
  currency: z.literal(OPS_CURRENCY),
  default_quote_terms: z.string().nullable(),
  default_retainer_percentage: z.union([z.number(), z.string()]),
  default_quote_validity_days: z.number().int(),
  default_deposit_due_days: z.number().int(),
  bank_name: z.string().nullable(),
  account_holder: z.string().nullable(),
  account_number: z.string().nullable(),
  branch_code: z.string().nullable(),
  account_type: z.string().nullable(),
  payment_reference_instructions: z.string().nullable(),
  sender_name: z.string(),
  sender_email: z.string(),
  reply_to_email: z.string(),
  version: z.number().int().positive(),
  updated_at: z.string(),
});

export type OpsSettingsRecord = z.infer<typeof opsSettingsRecordSchema>;

export function shapeOpsSettings(record: unknown): OpsSettings {
  const row = opsSettingsRecordSchema.parse(record);
  const retainer = Number(row.default_retainer_percentage);
  if (!Number.isFinite(retainer)) throw new Error("invalid retainer percentage");
  return {
    id: row.id,
    workspaceName: row.workspace_name,
    companyEmail: row.company_email,
    companyPhone: row.company_phone ?? "",
    websiteUrl: row.website_url ?? "",
    businessAddress: row.business_address ?? "",
    registrationNumber: row.registration_number ?? "",
    timeZone: row.time_zone,
    currency: row.currency,
    defaultQuoteTerms: row.default_quote_terms ?? "",
    defaultRetainerPercentage: retainer,
    defaultQuoteValidityDays: row.default_quote_validity_days,
    defaultDepositDueDays: row.default_deposit_due_days,
    bankName: row.bank_name ?? "",
    accountHolder: row.account_holder ?? "",
    accountNumber: row.account_number ?? "",
    branchCode: row.branch_code ?? "",
    accountType: row.account_type ?? "",
    paymentReferenceInstructions: row.payment_reference_instructions ?? "",
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    replyToEmail: row.reply_to_email,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export function settingsInput(settings: OpsSettings): OpsSettingsInput {
  return {
    workspaceName: settings.workspaceName,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone,
    websiteUrl: settings.websiteUrl,
    businessAddress: settings.businessAddress,
    registrationNumber: settings.registrationNumber,
    defaultQuoteTerms: settings.defaultQuoteTerms,
    defaultRetainerPercentage: settings.defaultRetainerPercentage,
    defaultQuoteValidityDays: settings.defaultQuoteValidityDays,
    defaultDepositDueDays: settings.defaultDepositDueDays,
    bankName: settings.bankName,
    accountHolder: settings.accountHolder,
    accountNumber: settings.accountNumber,
    branchCode: settings.branchCode,
    accountType: settings.accountType,
    paymentReferenceInstructions: settings.paymentReferenceInstructions,
    senderName: settings.senderName,
    senderEmail: settings.senderEmail,
    replyToEmail: settings.replyToEmail,
  };
}

export function settingsRpcPayload(input: OpsSettingsInput) {
  return {
    workspace_name: input.workspaceName,
    company_email: input.companyEmail,
    company_phone: input.companyPhone,
    website_url: input.websiteUrl,
    business_address: input.businessAddress,
    registration_number: input.registrationNumber,
    time_zone: OPS_TIME_ZONE,
    currency: OPS_CURRENCY,
    default_quote_terms: input.defaultQuoteTerms,
    default_retainer_percentage: input.defaultRetainerPercentage,
    default_quote_validity_days: input.defaultQuoteValidityDays,
    default_deposit_due_days: input.defaultDepositDueDays,
    bank_name: input.bankName,
    account_holder: input.accountHolder,
    account_number: input.accountNumber,
    branch_code: input.branchCode,
    account_type: input.accountType,
    payment_reference_instructions: input.paymentReferenceInstructions,
    sender_name: input.senderName,
    sender_email: input.senderEmail,
    reply_to_email: input.replyToEmail,
  };
}
