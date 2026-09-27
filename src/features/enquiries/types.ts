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
