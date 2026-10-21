export const QUOTE_STATUSES = [
  "Draft",
  "Sent",
  "Approved",
  "Expired",
  "Superseded",
  "Void",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceDisplayStatus = InvoiceStatus | "Open" | "Overdue" | "Partially Paid";
export const BILLING_TYPES = ["Standard", "Deposit", "Balance"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];
export const PAYMENT_METHODS = ["Bank Transfer", "Card", "Cash", "Other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type CommercialLineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
};

export type CommercialOwner = { id: string | null; name: string; email: string };

export type InvoiceListItem = {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  contactName: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  billingType: BillingType;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  issueDate: string;
  dueDate: string;
  paidAt: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  owner: CommercialOwner;
  version: number;
  createdAt: string;
};

export type QuoteListItem = {
  id: string;
  reference: string;
  revision: number;
  clientId: string;
  clientName: string;
  contactName: string;
  title: string;
  status: QuoteStatus;
  total: number;
  validUntil: string;
  owner: CommercialOwner;
  version: number;
  createdAt: string;
};

export type QuoteDetail = QuoteListItem & {
  enquiryId: string | null;
  projectId: string | null;
  overview: string;
  services: string[];
  location: string;
  currency: "ZAR";
  subtotal: number;
  discountAmount: number;
  retainerPercentage: number;
  terms: string;
  lineItems: CommercialLineItem[];
  contactId: string;
  approvedAt: string;
};

export type CommercialPayment = {
  id: string;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  recordedByName: string;
  createdAt: string;
};

export type CommercialActivity = {
  id: string;
  message: string;
  action: string;
  createdAt: string;
};

export type InvoiceDetail = InvoiceListItem & {
  quoteId: string | null;
  quoteReference: string | null;
  enquiryId: string | null;
  contactId: string;
  subtotal: number;
  discountAmount: number;
  overview: string;
  notes: string;
  currency: "ZAR";
  companySnapshot: Record<string, string>;
  paymentSnapshot: Record<string, string>;
  terms: string;
  lineItems: CommercialLineItem[];
  payments: CommercialPayment[];
  activity: CommercialActivity[];
  contact: { id: string; name: string; email: string; phone: string };
};

export type CommercialFormOption = {
  id: string;
  name: string;
  contacts: { id: string; name: string; email: string; phone: string }[];
  enquiries: { id: string; label: string }[];
  projects: { id: string; label: string }[];
};

export type CommercialFormData = {
  clients: CommercialFormOption[];
  defaults: {
    terms: string;
    retainerPercentage: number;
    depositDueDays: number;
  };
};

export type CommercialActionResult =
  | { status: "success"; id: string; version?: number; projectId?: string | null }
  | { status: "invalid"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "conflict"; message: string; version?: number }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

export type PublicQuote = {
  reference: string;
  revision: number;
  title: string;
  overview: string;
  status: QuoteStatus;
  clientName: string;
  contactName: string;
  currency: "ZAR";
  subtotal: number;
  discountAmount: number;
  total: number;
  retainerPercentage: number;
  terms: string;
  validUntil: string;
  issuedAt: string;
  approvedAt: string;
  company: Record<string, string>;
  lineItems: CommercialLineItem[];
  depositInvoice: null | {
    reference: string;
    total: number;
    paidAmount: number;
    dueDate: string;
    status: InvoiceStatus;
    payment: Record<string, string>;
  };
};
