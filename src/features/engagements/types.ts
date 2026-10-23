export const BOOKING_STATUSES = [
  "New",
  "Reviewing",
  "Quote Sent",
  "Awaiting Deposit",
  "Confirmed",
  "Completed",
  "Cancelled",
] as const;

export const PARTNERSHIP_STATUSES = [
  "New",
  "Reviewing",
  "Qualified",
  "Proposal Sent",
  "Active",
  "Closed",
  "Declined",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PartnershipStatus = (typeof PARTNERSHIP_STATUSES)[number];

export type PersonLink = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type BookingItem = {
  kind: "booking";
  id: string;
  client: PersonLink | null;
  contact: PersonLink | null;
  service: string;
  services: string[];
  date: string | null;
  start: string | null;
  location: string | null;
  projectDetails: string | null;
  dateFlexibility: string | null;
  budgetRange: string | null;
  status: BookingStatus;
  deposit: string;
  ownerName: string | null;
  ownerEmail: string | null;
  version: number;
  createdAt: string;
};

export type PartnershipItem = {
  kind: "partnership";
  id: string;
  client: PersonLink | null;
  contact: PersonLink | null;
  company: string;
  partnershipType: string;
  focusAreas: string[];
  brandGoals: string | null;
  industry: string | null;
  brandLink: string | null;
  brandLocation: string | null;
  contentFrequency: string | null;
  contactRole: string | null;
  budgetRange: string | null;
  status: PartnershipStatus;
  ownerName: string | null;
  ownerEmail: string | null;
  version: number;
  createdAt: string;
};

export type EngagementData = {
  bookings: BookingItem[];
  partnerships: PartnershipItem[];
};
