"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/server-env";
import {
  canonicalMimeType,
  checkFileCount,
  checkFileMeta,
} from "@/features/start-a-project/file-validation";
import {
  enquiryActivityMessage,
  newClientNotes,
  type UploadedFile,
} from "@/features/start-a-project/records";
import { projectEnquirySchema } from "@/features/start-a-project/schemas";
import {
  createSessionSecret,
  hashRequestAddress,
  requestAddress,
  secretsMatch,
  sha256,
} from "@/features/start-a-project/session-security";
import {
  cleanupSessionObjects,
  verifyStoredObject,
} from "@/features/start-a-project/storage-verification";
import {
  storagePathFor,
  type FinalizeEnquiryResult,
  type PrepareEnquiryResult,
  type UploadDescriptor,
} from "@/features/start-a-project/upload-contract";

const BUCKET = "enquiry-attachments";
const SESSION_SECRET = /^[A-Za-z0-9_-]{43}$/;

const uploadDescriptorSchema = z.object({
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(200),
});

const uploadedFileSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
});

const uploadSessionSchema = z.object({
  id: z.uuid(),
  client_secret_hash: z.string().length(64),
  status: z.enum(["pending", "finalizing", "completed", "failed", "expired"]),
  file_manifest: z.array(uploadedFileSchema).max(5),
  enquiry_id: z.uuid().nullable(),
  expires_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
});

const finalizerResultSchema = z.object({
  enquiry_id: z.uuid(),
  created: z.boolean(),
});

const PREPARE_INVALID: PrepareEnquiryResult = {
  status: "error",
  code: "invalid",
  error: "Some details look incomplete. Please check the form and try again.",
};
const PREPARE_FAILED: PrepareEnquiryResult = {
  status: "error",
  code: "failed",
  error: "We couldn't prepare those uploads just now. Please try again in a moment.",
};
const FINALIZE_INVALID: FinalizeEnquiryResult = {
  status: "error",
  code: "invalid",
  error: "This upload session is no longer valid. Please start again.",
};
const FINALIZE_FAILED: FinalizeEnquiryResult = {
  status: "error",
  code: "failed",
  error: "We couldn't finish sending that just now. Please try again in a moment.",
};
const FINALIZE_EXPIRED: FinalizeEnquiryResult = {
  status: "error",
  code: "expired",
  error: "This upload session has expired. Please start again.",
};

function fieldsFromFormData(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

async function loadUploadSession(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  sessionId: string,
) {
  const { data, error } = await supabase.rpc("get_enquiry_upload_session", {
    p_session_id: sessionId,
  });
  if (error) return { status: "error" as const };

  const parsed = uploadSessionSchema.safeParse(data);
  return parsed.success
    ? { status: "ok" as const, session: parsed.data }
    : { status: "not-found" as const };
}

async function failAndCleanSession(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  sessionId: string,
  manifest: UploadedFile[],
): Promise<void> {
  const failed = await supabase.rpc("mark_enquiry_upload_session_failed", {
    p_session_id: sessionId,
  });
  if (failed.error) {
    console.error("start-a-project: finalize mark-failed error", sessionId);
  }

  const cleaned = await cleanupSessionObjects(supabase, manifest);
  if (!cleaned) {
    console.error("start-a-project: finalize cleanup error", sessionId);
  }
}

export async function prepareProjectEnquiry(
  formData: FormData,
  descriptors: UploadDescriptor[],
): Promise<PrepareEnquiryResult> {
  const input = projectEnquirySchema.safeParse(fieldsFromFormData(formData));
  if (!input.success) return PREPARE_INVALID;
  if (input.data.hp_website) return { status: "accepted" };

  const parsedDescriptors = z.array(uploadDescriptorSchema).max(5).safeParse(descriptors);
  if (!parsedDescriptors.success) return PREPARE_INVALID;

  const countCheck = checkFileCount(parsedDescriptors.data.length);
  if (!countCheck.ok) {
    return { status: "error", code: "invalid", error: countCheck.error };
  }

  for (const descriptor of parsedDescriptors.data) {
    const metaCheck = checkFileMeta(descriptor.fileName, descriptor.sizeBytes);
    if (!metaCheck.ok) {
      return { status: "error", code: "invalid", error: metaCheck.error };
    }
    if (canonicalMimeType(descriptor.fileName) !== descriptor.mimeType) {
      return PREPARE_INVALID;
    }
  }

  const sessionId = crypto.randomUUID();
  const sessionSecret = createSessionSecret();
  const manifest: UploadedFile[] = parsedDescriptors.data.map((descriptor, index) => ({
    storage_path: storagePathFor(sessionId, index, descriptor.fileName),
    file_name: descriptor.fileName,
    mime_type: descriptor.mimeType,
    size_bytes: descriptor.sizeBytes,
  }));

  try {
    const serverEnv = getServerEnv();
    const supabase = createSupabaseServiceClient();
    const address = requestAddress(await headers());
    const { error: sessionError } = await supabase.rpc("create_enquiry_upload_session", {
      p_session_id: sessionId,
      p_ip_hash: hashRequestAddress(address, serverEnv.ENQUIRY_UPLOAD_RATE_LIMIT_SECRET),
      p_client_secret_hash: sha256(sessionSecret),
      p_file_manifest: manifest,
    });

    if (sessionError) {
      if (sessionError.message.includes("upload_rate_limit_exceeded")) {
        return {
          status: "error",
          code: "rate-limited",
          error: "Too many upload attempts. Please wait an hour and try again.",
        };
      }
      console.error("start-a-project: prepare session error", sessionId);
      return PREPARE_FAILED;
    }

    const uploads = [];
    for (const [index, file] of manifest.entries()) {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUploadUrl(file.storage_path, { upsert: false });
        if (error || !data?.signedUrl) throw new Error("signed upload URL creation failed");
        uploads.push({
          index,
          fileName: file.file_name,
          sizeBytes: file.size_bytes,
          mimeType: file.mime_type,
          storagePath: file.storage_path,
          uploadUrl: data.signedUrl,
        });
      } catch {
        await supabase.rpc("mark_enquiry_upload_session_failed", {
          p_session_id: sessionId,
        });
        console.error("start-a-project: prepare token error", sessionId);
        return PREPARE_FAILED;
      }
    }

    return { status: "ready", sessionId, sessionSecret, uploads };
  } catch {
    console.error("start-a-project: prepare unexpected error", sessionId);
    return PREPARE_FAILED;
  }
}

export async function finalizeProjectEnquiry(
  formData: FormData,
  sessionId: string,
  sessionSecret: string,
): Promise<FinalizeEnquiryResult> {
  const input = projectEnquirySchema.safeParse(fieldsFromFormData(formData));
  if (
    !input.success ||
    !z.uuid().safeParse(sessionId).success ||
    !SESSION_SECRET.test(sessionSecret)
  ) {
    return FINALIZE_INVALID;
  }
  if (input.data.hp_website) return { status: "complete" };

  try {
    const publicEnv = getPublicEnv();
    const serverEnv = getServerEnv();
    const supabase = createSupabaseServiceClient();
    const loaded = await loadUploadSession(supabase, sessionId);

    if (loaded.status === "error") {
      console.error("start-a-project: finalize session error", sessionId);
      return FINALIZE_FAILED;
    }
    if (loaded.status === "not-found") return FINALIZE_INVALID;

    const session = loaded.session;
    if (!secretsMatch(sessionSecret, session.client_secret_hash)) return FINALIZE_INVALID;
    if (session.status === "completed") return { status: "complete" };
    if (session.status === "expired" || Date.parse(session.expires_at) <= Date.now()) {
      return FINALIZE_EXPIRED;
    }
    if (session.status === "failed") return FINALIZE_INVALID;

    for (const file of session.file_manifest) {
      const verification = await verifyStoredObject(supabase, file, {
        supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      });
      if (!verification.ok) {
        if (verification.reason === "unavailable") {
          console.error("start-a-project: finalize verify unavailable", sessionId);
          return FINALIZE_FAILED;
        }
        await failAndCleanSession(supabase, sessionId, session.file_manifest);
        return {
          status: "error",
          code: "invalid",
          error: "One or more attachments could not be verified. Please start again.",
        };
      }
    }

    const { data: finalizerData, error: finalizerError } = await supabase.rpc(
      "finalize_enquiry_upload_session",
      {
        p_session_id: sessionId,
        p_full_name: input.data.full_name,
        p_company: input.data.company || null,
        p_email: input.data.email,
        p_phone: input.data.phone,
        p_project_type: input.data.project_type,
        p_location: input.data.location,
        p_timeline: input.data.timeline,
        p_description: input.data.description,
        p_budget: input.data.budget || null,
        p_client_notes: newClientNotes(input.data.company),
      },
    );
    const finalizerResult = finalizerResultSchema.safeParse(finalizerData);

    if (finalizerError || !finalizerResult.success) {
      const reloaded = await loadUploadSession(supabase, sessionId);
      if (reloaded.status === "ok" && reloaded.session.status === "completed") {
        return { status: "complete" };
      }
      console.error("start-a-project: finalize rpc error", sessionId);
      if (reloaded.status === "ok") {
        await failAndCleanSession(supabase, sessionId, session.file_manifest);
      }
      return FINALIZE_FAILED;
    }

    if (finalizerResult.data.created) {
      try {
        const { error: activityError } = await supabase.from("ops_activity_log").insert({
          message: enquiryActivityMessage(input.data.full_name),
          collection: "enquiries",
          record_id: finalizerResult.data.enquiry_id,
        });
        if (activityError) throw activityError;
      } catch {
        console.error("start-a-project: finalize activity error", sessionId);
      }
    }

    return { status: "complete" };
  } catch {
    console.error("start-a-project: finalize unexpected error", sessionId);
    return FINALIZE_FAILED;
  }
}
