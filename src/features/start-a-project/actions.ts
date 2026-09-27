"use server";

import { createSupabaseAnonClient } from "@/lib/db/anon";
import {
  checkFileContent,
  checkFileCount,
  checkFileMeta,
  sanitizeFileName,
} from "@/features/start-a-project/file-validation";
import {
  enquiryActivityMessage,
  submitEnquiryArgs,
  type UploadedFile,
} from "@/features/start-a-project/records";
import { projectEnquirySchema } from "@/features/start-a-project/schemas";

export type EnquiryResult = { ok: true } | { ok: false; error: string };

const INVALID: EnquiryResult = {
  ok: false,
  error: "Some details look incomplete. Please check the form and try again.",
};
const FAILED: EnquiryResult = {
  ok: false,
  error: "We couldn't send that just now. Please try again in a moment.",
};

const BUCKET = "enquiry-attachments";

function fieldsFromFormData(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

/**
 * Validates the form and every attachment, uploads the attachments to
 * private Storage, then writes the client/enquiry/attachment rows through
 * submit_enquiry(). Every file is fully validated (size, extension, then
 * its real content) before any of them are uploaded, so a later rejection
 * never leaves an earlier file stranded in Storage.
 */
export async function submitProjectEnquiry(formData: FormData): Promise<EnquiryResult> {
  const input = projectEnquirySchema.safeParse(fieldsFromFormData(formData));
  if (!input.success) return INVALID;
  if (input.data.hp_website) return { ok: true }; // bot: pretend it worked, store nothing

  const files = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const countCheck = checkFileCount(files.length);
  if (!countCheck.ok) return { ok: false, error: countCheck.error };

  const readFiles: { file: File; bytes: Uint8Array }[] = [];
  for (const file of files) {
    const metaCheck = checkFileMeta(file.name, file.size);
    if (!metaCheck.ok) return { ok: false, error: metaCheck.error };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentCheck = checkFileContent(file.name, bytes);
    if (!contentCheck.ok) return { ok: false, error: contentCheck.error };
    readFiles.push({ file, bytes });
  }

  const supabase = createSupabaseAnonClient();
  const submissionId = crypto.randomUUID();
  const uploaded: UploadedFile[] = [];

  for (const [index, { file, bytes }] of readFiles.entries()) {
    const storagePath = `${submissionId}/${index}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      console.error("start-a-project: file upload failed:", error.message);
      return FAILED;
    }
    uploaded.push({
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
  }

  const { error: rpcError } = await supabase.rpc(
    "submit_enquiry",
    submitEnquiryArgs(input.data, uploaded),
  );
  if (rpcError) {
    console.error("start-a-project: submit_enquiry failed:", rpcError.message);
    return FAILED;
  }

  // Best-effort: the enquiry itself is already saved even if this fails.
  const { error: activityError } = await supabase
    .from("ops_activity_log")
    .insert({ message: enquiryActivityMessage(input.data.full_name) });
  if (activityError) {
    console.error("start-a-project: activity log insert failed:", activityError.message);
  }

  return { ok: true };
}
