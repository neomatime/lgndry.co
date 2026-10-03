import { relativeTime } from "@/features/enquiries/relative-time";
import type {
  AccountTier,
  ClientActivity,
  ClientContact,
  ClientStatus,
  ClientType,
  LinkedEnquiry,
  LinkedProject,
} from "@/features/clients/types";
import type { EnquiryStatus } from "@/features/enquiries/types";

export type ClientDetail = {
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
  contacts: ClientContact[];
  enquiries: LinkedEnquiry[];
  projects: LinkedProject[];
  openEnquiryCount: number;
  activity: ClientActivity[];
};

export function buildClientDetail(
  client: {
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
  },
  contacts: {
    id: string;
    full_name: string;
    role_title: string | null;
    email: string;
    phone: string | null;
    is_primary: boolean;
  }[],
  enquiries: { id: string; project_type: string; status: EnquiryStatus; created_at: string }[],
  projects: {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    delivery_status: string;
    archived: boolean;
  }[],
  activity: { id: string; message: string; created_at: string }[],
  now = new Date(),
): ClientDetail {
  const shapedContacts = contacts
    .map((contact) => ({
      id: contact.id,
      fullName: contact.full_name,
      roleTitle: contact.role_title ?? "",
      email: contact.email,
      phone: contact.phone ?? "",
      isPrimary: contact.is_primary,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const shapedEnquiries = enquiries
    .map((enquiry) => ({
      id: enquiry.id,
      projectType: enquiry.project_type,
      status: enquiry.status,
      createdAt: enquiry.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    id: client.id,
    name: client.name ?? "Unnamed client",
    type: client.type ?? "Individual",
    status: client.status,
    accountTier: client.account_tier,
    industry: client.industry,
    region: client.region,
    clientSince: client.client_since,
    accountOverview: client.account_overview,
    preferredServices: client.preferred_services,
    relationshipNotes: client.relationship_notes,
    archived: client.archived,
    contacts: shapedContacts,
    enquiries: shapedEnquiries,
    projects: projects
      .map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        startDate: project.start_date ?? "",
        endDate: project.end_date ?? "",
        deliveryStatus: project.delivery_status,
        archived: project.archived,
      }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name)),
    openEnquiryCount: shapedEnquiries.filter(
      (item) => !["Completed", "Closed"].includes(item.status),
    ).length,
    activity: activity.map((entry) => ({
      id: entry.id,
      message: entry.message,
      createdAt: entry.created_at,
      relativeTime: relativeTime(entry.created_at, now),
    })),
  };
}
