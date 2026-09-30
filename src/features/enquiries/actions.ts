"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enquiryEditSchema, type EnquiryEditInput } from "@/features/enquiries/schemas";
import { MANUAL_ENQUIRY_STATUSES } from "@/features/enquiries/types";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

export type EnquiryActionResult =
  | { status: "success"; enquiryId: string }
  | { status: "invalid"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "conflict"; projectId: string; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const UUID = z.uuid();
const FAILED = "We couldn't save this enquiry just now. Please try again.";
const rpcResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), enquiry_id: z.uuid() }),
  z.object({ status: z.literal("not-found") }),
  z.object({ status: z.literal("conflict"), project_id: z.uuid() }),
  z.object({ status: z.literal("invalid"), message: z.string().optional() }),
]);

function errorsFor(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

function revalidateEnquiry(enquiryId: string) {
  revalidatePath("/ops/enquiries");
  revalidatePath(`/ops/enquiries/${enquiryId}`);
  revalidatePath(`/ops/enquiries/${enquiryId}/edit`);
  revalidatePath("/ops/clients");
}

function parseRpc(
  operation: string,
  data: unknown,
  error: { message?: string } | null,
): EnquiryActionResult {
  if (error) {
    console.error(`enquiries: ${operation} failed`, error.message ?? "database error");
    return { status: "error", message: FAILED };
  }
  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`enquiries: ${operation} returned an invalid response`);
    return { status: "error", message: FAILED };
  }
  if (parsed.data.status === "not-found") {
    return { status: "not-found", message: "That enquiry is no longer available." };
  }
  if (parsed.data.status === "conflict") {
    return {
      status: "conflict",
      projectId: parsed.data.project_id,
      message: "This enquiry's status is managed by its linked project.",
    };
  }
  if (parsed.data.status === "invalid") {
    return {
      status: "invalid",
      message: parsed.data.message ?? "Check the enquiry details and try again.",
    };
  }
  revalidateEnquiry(parsed.data.enquiry_id);
  return { status: "success", enquiryId: parsed.data.enquiry_id };
}

function payload(input: EnquiryEditInput) {
  return {
    full_name: input.fullName,
    company: input.company,
    email: input.email,
    phone: input.phone,
    project_type: input.projectType,
    location: input.location,
    timeline: input.timeline,
    description: input.description,
    budget: input.budget,
  };
}

export async function updateEnquiry(
  enquiryId: string,
  input: unknown,
): Promise<EnquiryActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(enquiryId).success) return { status: "error", message: FAILED };
  const parsed = enquiryEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check the highlighted enquiry details and try again.",
      fieldErrors: errorsFor(parsed.error),
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_enquiry_record", {
    p_enquiry_id: enquiryId,
    p_enquiry: payload(parsed.data),
  });
  return parseRpc("update", data, error);
}

export async function setEnquiryStatus(
  enquiryId: string,
  status: unknown,
): Promise<EnquiryActionResult> {
  await requireOpsUser();
  const parsed = z
    .object({ enquiryId: UUID, status: z.enum(MANUAL_ENQUIRY_STATUSES) })
    .safeParse({ enquiryId, status });
  if (!parsed.success) {
    return { status: "invalid", message: "Choose a valid enquiry status." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_enquiry_status", {
    p_enquiry_id: parsed.data.enquiryId,
    p_status: parsed.data.status,
  });
  return parseRpc("status update", data, error);
}
