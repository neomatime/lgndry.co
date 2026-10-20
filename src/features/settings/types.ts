export const OPS_SETTINGS_ID = "00000000-0000-4000-8000-000000000001";
export const OPS_TIME_ZONE = "Africa/Johannesburg" as const;
export const OPS_CURRENCY = "ZAR" as const;

export type OpsSettingsInput = {
  workspaceName: string;
  companyEmail: string;
  companyPhone: string;
  websiteUrl: string;
  businessAddress: string;
  registrationNumber: string;
  defaultQuoteTerms: string;
  defaultRetainerPercentage: number;
  defaultQuoteValidityDays: number;
  defaultDepositDueDays: number;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  paymentReferenceInstructions: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
};

export type OpsSettings = OpsSettingsInput & {
  id: string;
  timeZone: typeof OPS_TIME_ZONE;
  currency: typeof OPS_CURRENCY;
  version: number;
  updatedAt: string;
};

export type OpsSettingsActionResult =
  | { status: "success"; version: number }
  | { status: "invalid"; message: string; fieldErrors: Record<string, string[]> }
  | { status: "conflict"; message: string; currentVersion: number }
  | { status: "error"; message: string };
