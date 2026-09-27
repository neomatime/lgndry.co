import type { ProjectEnquiryInput } from "./schemas";

const dash = (value: string) => value || "-";

/** Notes stored on a newly created client row, matching the existing lead-capture convention. */
export function newClientNotes(company: string): string {
  return `Company: ${dash(company)}`;
}

/** The database rejects activity messages over 200 characters. */
export function enquiryActivityMessage(fullName: string): string {
  const message = `New project enquiry from ${fullName || "website visitor"}`;
  return message.length <= 200 ? message : `${message.slice(0, 197)}...`;
}

export type UploadedFile = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

/** The exact argument object for the submit_enquiry() RPC call. */
export function submitEnquiryArgs(input: ProjectEnquiryInput, uploaded: UploadedFile[]) {
  return {
    full_name: input.full_name,
    company: input.company || null,
    email: input.email,
    phone: input.phone,
    project_type: input.project_type,
    location: input.location,
    timeline: input.timeline,
    description: input.description,
    budget: input.budget || null,
    client_notes: newClientNotes(input.company),
    attachments: uploaded,
  };
}
