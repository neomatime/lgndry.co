import { relativeTime } from "@/features/enquiries/relative-time";
import type { EnquiryStatus } from "@/features/enquiries/types";
import type { ProjectEnquiryInput } from "@/features/start-a-project/schemas";

export type EnquiryDetail = {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  phone: string;
  projectType: ProjectEnquiryInput["project_type"];
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  source: string;
  createdAt: string;
  attachments: { fileName: string; sizeBytes: number; url: string | null }[];
  activity: { id: string; message: string; relativeTime: string }[];
  project: { id: string; name: string; status: string } | null;
};

type EnquiryRecord = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string;
  project_type: ProjectEnquiryInput["project_type"];
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  source: string;
  created_at: string;
};

type AttachmentRecord = { file_name: string; storage_path: string; size_bytes: number };
type ActivityRecord = { id: string; message: string; created_at: string };

/** Pure view-model builder, kept separate from data fetching so it's testable without mocking. */
export function buildEnquiryDetail(
  enquiry: EnquiryRecord,
  attachments: AttachmentRecord[],
  signedUrlByPath: Map<string, string | null>,
  activity: ActivityRecord[],
  now: Date = new Date(),
  project: { id: string; name: string; status: string } | null = null,
): EnquiryDetail {
  return {
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
    source: enquiry.source,
    createdAt: enquiry.created_at,
    attachments: attachments.map((attachment) => ({
      fileName: attachment.file_name,
      sizeBytes: attachment.size_bytes,
      url: signedUrlByPath.get(attachment.storage_path) ?? null,
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      message: entry.message,
      relativeTime: relativeTime(entry.created_at, now),
    })),
    project,
  };
}
