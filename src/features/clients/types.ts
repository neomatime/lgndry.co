import type { EnquiryStatus } from "@/features/enquiries/types";

export const CLIENT_TYPES = ["Company", "Individual"] as const;
export const CLIENT_STATUSES = ["Lead", "Active", "At Risk", "Inactive"] as const;
export const ACCOUNT_TIERS = ["Standard", "Key Account"] as const;
export const CLIENT_FILTERS = [
  "All",
  "Leads",
  "Active",
  "Key Accounts",
  "At Risk",
  "Inactive",
  "Archived",
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type AccountTier = (typeof ACCOUNT_TIERS)[number];
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export type ClientContactInput = {
  id?: string;
  fullName: string;
  roleTitle: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type ClientInput = {
  name: string;
  type: ClientType;
  status: ClientStatus;
  accountTier: AccountTier;
  industry: string;
  region: string;
  clientSince: string;
  accountOverview: string;
  preferredServices: string[];
  relationshipNotes: string;
  contacts: ClientContactInput[];
};

export type ClientContact = ClientContactInput & { id: string };

export type LinkedEnquiry = {
  id: string;
  projectType: string;
  status: EnquiryStatus;
  createdAt: string;
};

export type LinkedProject = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  deliveryStatus: string;
  archived: boolean;
};

export type ClientActivity = {
  id: string;
  message: string;
  createdAt: string;
  relativeTime: string;
};
