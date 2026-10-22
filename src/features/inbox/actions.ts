"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  attachmentUploadSchema,
  draftSchema,
  threadLinksSchema,
  threadStateSchema,
} from "@/features/inbox/schemas";
import type { InboxActionState, InboxUploadState } from "@/features/inbox/types";
import { emailMarkupToHtml, emailMarkupToPlainText } from "@/features/inbox/email-formatting";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

const rpcResultSchema = z.object({
  status: z.enum(["ok", "not-found", "conflict", "invalid"]),
  thread_id: z.uuid().optional(),
  email_id: z.uuid().optional(),
  version: z.number().int().positive().optional(),
  message: z.string().optional(),
});

const FAILED = "We couldn't update the Inbox just now. Please try again.";

function result(data: unknown, error: { message?: string } | null): InboxActionState {
  if (error) {
    console.error("Inbox RPC failed", error.message ?? error);
    return { status: "error", message: FAILED };
  }
  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Inbox RPC returned an invalid response");
    return { status: "error", message: FAILED };
  }
  if (parsed.data.status === "ok") {
    revalidatePath("/ops/inbox");
    return {
      status: "success",
      threadId: parsed.data.thread_id,
      emailId: parsed.data.email_id,
      version: parsed.data.version,
    };
  }
  if (parsed.data.status === "conflict") {
    return {
      status: "conflict",
      message: "This conversation changed elsewhere. Refresh and try again.",
    };
  }
  if (parsed.data.status === "not-found") {
    return { status: "not-found", message: "That conversation is no longer available." };
  }
  return { status: "invalid", message: parsed.data.message ?? "Check the details and try again." };
}

export async function updateEmailThreadState(input: unknown): Promise<InboxActionState> {
  await requireOpsUser();
  const parsed = threadStateSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", message: "Refresh the Inbox and try again." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_email_thread_state", {
    p_thread_id: parsed.data.threadId,
    p_action: parsed.data.action,
    p_expected_version: parsed.data.version,
  });
  return result(data, error);
}

export async function updateEmailThreadLinks(input: unknown): Promise<InboxActionState> {
  await requireOpsUser();
  const parsed = threadLinksSchema.safeParse(input);
  if (!parsed.success)
    return { status: "invalid", message: "Check the linked records and try again." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("link_email_thread", {
    p_thread_id: parsed.data.threadId,
    p_expected_version: parsed.data.version,
    p_links: {
      client_id: parsed.data.clientId,
      contact_id: parsed.data.contactId,
      enquiry_id: parsed.data.enquiryId,
      project_id: parsed.data.projectId,
      quote_id: parsed.data.quoteId,
      invoice_id: parsed.data.invoiceId,
      follow_up_id: parsed.data.followUpId,
    },
  });
  return result(data, error);
}

export async function saveEmailDraft(input: unknown): Promise<InboxActionState> {
  const user = await requireOpsUser();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the message and try again.",
    };
  }
  const plainText = emailMarkupToPlainText(parsed.data.body);
  const html = emailMarkupToHtml(parsed.data.body);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_email_draft", {
    p_email_id: parsed.data.emailId ?? null,
    p_thread_id: parsed.data.threadId ?? null,
    p_expected_version: parsed.data.version ?? null,
    p_payload: {
      to_email: parsed.data.toEmail,
      to_name: parsed.data.toName ?? "",
      cc: parsed.data.cc ?? "",
      bcc: parsed.data.bcc ?? "",
      subject: parsed.data.subject,
      body: plainText,
      body_html: html,
      owner: user.name,
    },
  });
  const saved = result(data, error);
  if (saved.status !== "success" || parsed.data.intent === "draft") return saved;

  const response = await supabase.functions.invoke("send-admin-email", {
    body: {
      emailId: saved.emailId,
      threadId: saved.threadId,
      to: parsed.data.toEmail,
      cc: parsed.data.cc,
      bcc: parsed.data.bcc,
      subject: parsed.data.subject,
      text: plainText,
      html,
    },
  });
  if (response.error || response.data?.error) {
    console.error("Inbox send failed", response.error?.message ?? response.data?.error);
    return {
      status: "error",
      message: "The message is saved as a draft, but it could not be sent. Try sending it again.",
    };
  }
  revalidatePath("/ops/inbox");
  return { ...saved, message: "Email sent." };
}

export async function deleteEmailDraft(input: unknown): Promise<InboxActionState> {
  await requireOpsUser();
  const parsed = z
    .object({ emailId: z.uuid(), version: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { status: "invalid", message: "That draft is not valid." };
  const supabase = await createSupabaseServerClient();
  const { data: attachments } = await supabase
    .from("email_attachments")
    .select("storage_path")
    .eq("email_id", parsed.data.emailId)
    .not("storage_path", "is", null);
  const { data, error } = await supabase.rpc("delete_email_draft", {
    p_email_id: parsed.data.emailId,
    p_expected_version: parsed.data.version,
  });
  const state = result(data, error);
  if (state.status === "success") {
    const paths = (attachments ?? []).flatMap((item) =>
      item.storage_path ? [item.storage_path] : [],
    );
    if (paths.length) {
      const { error: storageError } = await supabase.storage
        .from("email-attachments")
        .remove(paths);
      if (storageError) {
        console.error("Inbox draft attachment cleanup failed", storageError.message);
      }
    }
  }
  return state;
}

export async function syncInbox(): Promise<InboxActionState> {
  await requireOpsUser();
  const supabase = await createSupabaseServerClient();
  const response = await supabase.functions.invoke("sync-titan-inbox", { body: {} });
  if (response.error || response.data?.error) {
    console.error("Inbox sync failed", response.error?.message ?? response.data?.error);
    return { status: "error", message: "The mailbox could not be synchronized just now." };
  }
  revalidatePath("/ops/inbox");
  const count = Number(response.data?.synced ?? 0);
  return {
    status: "success",
    message: count === 1 ? "1 new email synchronized." : `${count} new emails synchronized.`,
  };
}

export async function prepareEmailAttachmentUpload(input: unknown): Promise<InboxUploadState> {
  await requireOpsUser();
  const parsed = attachmentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "That file cannot be uploaded.",
    };
  }
  const saved = await saveEmailDraft({ ...parsed.data.draft, intent: "draft" });
  if (saved.status !== "success") return saved;
  if (!saved.threadId || !saved.emailId || !saved.version) {
    return { status: "error", message: "The attachment draft could not be created." };
  }

  const safeName = parsed.data.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${saved.threadId}/${saved.emailId}/${crypto.randomUUID()}-${safeName}`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from("email-attachments")
    .createSignedUploadUrl(storagePath);
  if (error || !data?.signedUrl) {
    console.error("Inbox attachment signing failed", error?.message ?? "missing signed URL");
    return { status: "error", message: "The attachment upload could not be started." };
  }
  return {
    status: "success",
    threadId: saved.threadId,
    emailId: saved.emailId,
    version: saved.version,
    storagePath,
    signedUrl: data.signedUrl,
  };
}

export async function finalizeEmailAttachmentUpload(input: unknown): Promise<InboxActionState> {
  await requireOpsUser();
  const parsed = z
    .object({
      emailId: z.uuid(),
      storagePath: z.string().min(1).max(1000),
      fileName: z.string().trim().min(1).max(255),
      contentType: z.string().min(1).max(255),
      sizeBytes: z
        .number()
        .int()
        .positive()
        .max(25 * 1024 * 1024),
      version: z.number().int().positive(),
    })
    .safeParse(input);
  if (!parsed.success) return { status: "invalid", message: "That attachment is not valid." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_email_attachment", {
    p_email_id: parsed.data.emailId,
    p_file_name: parsed.data.fileName,
    p_content_type: parsed.data.contentType,
    p_size_bytes: parsed.data.sizeBytes,
    p_storage_path: parsed.data.storagePath,
    p_expected_version: parsed.data.version,
  });
  return result(data, error);
}
