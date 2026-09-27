import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/features/enquiries/types";

export type EnquiryListItem = {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  phone: string;
  projectType: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  createdAt: string;
  attachmentCount: number;
};

type EnquiryRecord = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string;
  project_type: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  created_at: string;
};

/** Pure view-model builder, kept separate from data fetching so it's testable without mocking. */
export function buildEnquiryListItems(
  enquiries: EnquiryRecord[],
  attachmentCounts: Map<string, number>,
): EnquiryListItem[] {
  return enquiries.map((enquiry) => ({
    id: enquiry.id,
    fullName: enquiry.full_name,
    company: enquiry.company,
    email: enquiry.email,
    phone: enquiry.phone,
    projectType: enquiry.project_type,
    location: enquiry.location,
    timeline: enquiry.timeline,
    description: enquiry.description,
    budget: enquiry.budget,
    status: enquiry.status,
    createdAt: enquiry.created_at,
    attachmentCount: attachmentCounts.get(enquiry.id) ?? 0,
  }));
}

export function computeEnquiryStats(rows: EnquiryListItem[]) {
  return {
    New: rows.filter((row) => row.status === "New").length,
    Reviewing: rows.filter((row) => row.status === "Reviewing").length,
    Quoted: rows.filter((row) => row.status === "Quoted").length,
    missingAttachments: rows.filter((row) => row.attachmentCount === 0).length,
  };
}

export function countByStatus(rows: EnquiryListItem[]): Record<EnquiryStatus, number> {
  const counts = Object.fromEntries(ENQUIRY_STATUSES.map((status) => [status, 0])) as Record<
    EnquiryStatus,
    number
  >;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export function filterEnquiries(
  rows: EnquiryListItem[],
  { status, search }: { status: EnquiryStatus | "All"; search: string },
): EnquiryListItem[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "All" && row.status !== status) return false;
    if (!query) return true;
    return (
      row.fullName.toLowerCase().includes(query) ||
      (row.company ?? "").toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.projectType.toLowerCase().includes(query)
    );
  });
}

export function sortEnquiries(
  rows: EnquiryListItem[],
  direction: "newest" | "oldest",
): EnquiryListItem[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return direction === "newest" ? sorted.reverse() : sorted;
}
