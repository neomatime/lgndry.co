import type {
  AccountTier,
  ClientContact,
  ClientFilter,
  ClientStatus,
  ClientType,
} from "@/features/clients/types";
import type { EnquiryStatus } from "@/features/enquiries/types";

export type ClientListRecord = {
  id: string;
  name: string | null;
  type: ClientType | null;
  status: ClientStatus;
  account_tier: AccountTier;
  industry: string | null;
  region: string | null;
  client_since: string;
  account_overview: string | null;
  preferred_services: string[];
  relationship_notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  client_contacts: {
    id: string;
    full_name: string;
    role_title: string | null;
    email: string;
    phone: string | null;
    is_primary: boolean;
  }[];
  enquiries: { id: string; status: EnquiryStatus; created_at: string }[];
};

export type ClientListItem = {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  accountTier: AccountTier;
  industry: string | null;
  region: string | null;
  clientSince: string;
  accountOverview: string | null;
  preferredServices: string[];
  relationshipNotes: string | null;
  archived: boolean;
  createdAt: string;
  contacts: ClientContact[];
  primaryContact: ClientContact | null;
  openEnquiryCount: number;
  lastActivityAt: string;
};

const OPEN = (status: EnquiryStatus) => status !== "Completed" && status !== "Closed";

export function buildClientListItems(
  records: ClientListRecord[],
  activityByClient: Map<string, string>,
): ClientListItem[] {
  return records.map((record) => {
    const contacts = record.client_contacts
      .map((contact) => ({
        id: contact.id,
        fullName: contact.full_name,
        roleTitle: contact.role_title ?? "",
        email: contact.email,
        phone: contact.phone ?? "",
        isPrimary: contact.is_primary,
      }))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    const candidates = [
      record.updated_at,
      activityByClient.get(record.id),
      ...record.enquiries.map((enquiry) => enquiry.created_at),
    ].filter((value): value is string => Boolean(value));
    const lastActivityAt = candidates.sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    )[0]!;

    return {
      id: record.id,
      name: record.name ?? "Unnamed client",
      type: record.type ?? "Individual",
      status: record.status,
      accountTier: record.account_tier,
      industry: record.industry,
      region: record.region,
      clientSince: record.client_since,
      accountOverview: record.account_overview,
      preferredServices: record.preferred_services,
      relationshipNotes: record.relationship_notes,
      archived: record.archived,
      createdAt: record.created_at,
      contacts,
      primaryContact: contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null,
      openEnquiryCount: record.enquiries.filter((enquiry) => OPEN(enquiry.status)).length,
      lastActivityAt,
    };
  });
}

export function computeClientStats(rows: ClientListItem[]) {
  const current = rows.filter((row) => !row.archived);
  return {
    active: current.filter((row) => row.status === "Active").length,
    keyAccounts: current.filter((row) => row.accountTier === "Key Account").length,
    leads: current.filter((row) => row.status === "Lead").length,
    openEnquiries: current.reduce((total, row) => total + row.openEnquiryCount, 0),
  };
}

export function filterClients(
  rows: ClientListItem[],
  { filter, search }: { filter: ClientFilter; search: string },
) {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === "Archived" ? !row.archived : row.archived) return false;
    if (filter === "Leads" && row.status !== "Lead") return false;
    if (filter === "Active" && row.status !== "Active") return false;
    if (filter === "At Risk" && row.status !== "At Risk") return false;
    if (filter === "Inactive" && row.status !== "Inactive") return false;
    if (filter === "Key Accounts" && row.accountTier !== "Key Account") return false;
    if (!query) return true;
    return [
      row.name,
      row.industry ?? "",
      row.region ?? "",
      ...row.contacts.flatMap((contact) => [contact.fullName, contact.email]),
    ].some((value) => value.toLowerCase().includes(query));
  });
}

export type ClientSort = "newest" | "oldest" | "name-asc" | "name-desc";

export function sortClients(rows: ClientListItem[], sort: ClientSort) {
  return [...rows].sort((a, b) => {
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sort === "newest" ? -delta : delta;
  });
}
