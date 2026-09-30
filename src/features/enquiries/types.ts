export const ENQUIRY_STATUSES = [
  "New",
  "Reviewing",
  "Quoted",
  "Follow-up",
  "Booked",
  "In Production",
  "Completed",
  "Closed",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const MANUAL_ENQUIRY_STATUSES = [
  "New",
  "Reviewing",
  "Quoted",
  "Follow-up",
  "Closed",
] as const satisfies readonly EnquiryStatus[];

export type ManualEnquiryStatus = (typeof MANUAL_ENQUIRY_STATUSES)[number];
