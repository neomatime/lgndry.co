export type EnquiryRow = {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  projectType: string;
  status: string;
  submittedAt: string;
  attachments: { fileName: string; url: string | null }[];
};

type EnquiryRecord = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  project_type: string;
  status: string;
  created_at: string;
};

type AttachmentRecord = { file_name: string; storage_path: string };

/** Pure view-model builder, kept separate from data fetching so it's easy to test. */
export function buildEnquiryRows(
  enquiries: EnquiryRecord[],
  attachmentsByEnquiry: Map<string, AttachmentRecord[]>,
  signedUrlByPath: Map<string, string | null>,
): EnquiryRow[] {
  return enquiries.map((enquiry) => ({
    id: enquiry.id,
    fullName: enquiry.full_name,
    company: enquiry.company,
    email: enquiry.email,
    projectType: enquiry.project_type,
    status: enquiry.status,
    submittedAt: enquiry.created_at,
    attachments: (attachmentsByEnquiry.get(enquiry.id) ?? []).map((attachment) => ({
      fileName: attachment.file_name,
      url: signedUrlByPath.get(attachment.storage_path) ?? null,
    })),
  }));
}
