"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nextOccurrenceDate, createRecurrenceRule } from "@/features/follow-ups/recurrence";
import {
  cancelFollowUpSchema,
  completeFollowUpSchema,
  followUpInputSchema,
  rescheduleFollowUpSchema,
  type ParsedFollowUpInput,
} from "@/features/follow-ups/schemas";
import type { FollowUpActionState } from "@/features/follow-ups/types";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID = z.uuid();
const FAILED = "We couldn't save this follow-up just now. Please try again.";
const rpcResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    follow_up_id: z.uuid(),
    successor_id: z.uuid().nullable().optional(),
  }),
  z.object({ status: z.literal("not-found") }),
  z.object({
    status: z.literal("conflict"),
    message: z.string().optional(),
    successor_id: z.uuid().optional(),
  }),
  z.object({ status: z.literal("invalid"), message: z.string().optional() }),
]);

function errors(error: z.ZodError) {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues)
    (result[issue.path.join(".") || "form"] ??= []).push(issue.message);
  return result;
}

function invalid(error: z.ZodError): FollowUpActionState {
  return {
    status: "invalid",
    message: "Check the highlighted details and try again.",
    fieldErrors: errors(error),
  };
}

function revalidateFollowUp(id: string, clientId?: string, enquiryId?: string, projectId?: string) {
  revalidatePath("/ops/follow-ups");
  revalidatePath(`/ops/follow-ups/${id}`);
  revalidatePath(`/ops/follow-ups/${id}/edit`);
  if (clientId) revalidatePath(`/ops/clients/${clientId}`);
  if (enquiryId) revalidatePath(`/ops/enquiries/${enquiryId}`);
  if (projectId) revalidatePath(`/ops/projects/${projectId}`);
}

function parseRpc(
  operation: string,
  data: unknown,
  error: { message?: string } | null,
  relations?: { clientId?: string; enquiryId?: string; projectId?: string },
): FollowUpActionState {
  if (error) {
    console.error(`follow-ups: ${operation} failed`, error.message ?? "database error");
    return { status: "error", message: FAILED };
  }
  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`follow-ups: ${operation} returned an invalid response`);
    return { status: "error", message: FAILED };
  }
  if (parsed.data.status === "not-found")
    return { status: "not-found", message: "That follow-up is no longer available." };
  if (parsed.data.status === "invalid")
    return {
      status: "invalid",
      message: parsed.data.message ?? "Check the follow-up details and try again.",
    };
  if (parsed.data.status === "conflict")
    return {
      status: "conflict",
      message: parsed.data.message ?? "This follow-up changed elsewhere. Refresh and try again.",
      successorId: parsed.data.successor_id,
    };
  revalidateFollowUp(
    parsed.data.follow_up_id,
    relations?.clientId,
    relations?.enquiryId,
    relations?.projectId,
  );
  if (parsed.data.successor_id) revalidateFollowUp(parsed.data.successor_id);
  return {
    status: "success",
    followUpId: parsed.data.follow_up_id,
    successorId: parsed.data.successor_id,
  };
}

function payload(input: ParsedFollowUpInput, owner?: { name: string; email: string }) {
  return {
    followUp: {
      client_id: input.clientId,
      contact_id: input.contactId,
      enquiry_id: input.enquiryId,
      project_id: input.projectId,
      follow_up_type: input.followUpType,
      custom_type: input.customType,
      title: input.title,
      overview: input.overview,
      notes: input.notes,
      due_date: input.dueDate,
      due_time: input.dueTime,
      priority: input.priority,
      contact_methods: input.contactMethods,
      ...(owner ? { owner_name: owner.name, owner_email: owner.email } : {}),
    },
    checklist: input.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      sort_order: item.sortOrder,
    })),
    recurrence: {
      enabled: input.recurrence.enabled,
      frequency: input.recurrence.frequency,
      interval_count: input.recurrence.intervalCount,
      weekdays: input.recurrence.weekdays,
      month_anchor: input.recurrence.monthAnchor,
      ends_on: input.recurrence.endsOn,
      max_occurrences: input.recurrence.maxOccurrences,
      recurrence_rule: createRecurrenceRule(input.dueDate, input.recurrence),
    },
  };
}

export async function createFollowUp(input: unknown): Promise<FollowUpActionState> {
  const user = await requireOpsUser();
  const parsed = followUpInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const shaped = payload(parsed.data, { name: user.name, email: user.email });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_follow_up", {
    p_follow_up: shaped.followUp,
    p_checklist: shaped.checklist,
    p_recurrence: shaped.recurrence,
  });
  return parseRpc("create", data, error, {
    clientId: parsed.data.clientId,
    enquiryId: parsed.data.enquiryId,
    projectId: parsed.data.projectId,
  });
}

export async function updateFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const parsed = followUpInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const shaped = payload(parsed.data);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_follow_up", {
    p_follow_up_id: id,
    p_follow_up: shaped.followUp,
    p_checklist: shaped.checklist,
    p_recurrence: shaped.recurrence,
    p_scope: parsed.data.editScope,
    p_version: version,
  });
  return parseRpc("update", data, error, {
    clientId: parsed.data.clientId,
    enquiryId: parsed.data.enquiryId,
    projectId: parsed.data.projectId,
  });
}

async function nextDateFor(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("due_date, series:follow_up_series(recurrence_rule)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const series = Array.isArray(data.series) ? data.series[0] : data.series;
  return series?.recurrence_rule ? nextOccurrenceDate(data.due_date, series.recurrence_rule) : null;
}

export async function setFollowUpChecklistItem(
  itemId: string,
  completed: boolean,
  version: number,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(itemId).success) return { status: "error", message: FAILED };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_follow_up_checklist_item", {
    p_item_id: itemId,
    p_completed: completed,
    p_version: version,
  });
  return parseRpc("checklist", data, error);
}

export async function rescheduleFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const parsed = rescheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reschedule_follow_up", {
    p_follow_up_id: id,
    p_due_date: parsed.data.dueDate,
    p_due_time: parsed.data.dueTime || null,
    p_scope: parsed.data.scope,
    p_recurrence: {},
    p_version: version,
  });
  return parseRpc("reschedule", data, error);
}

export async function completeFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const next = await nextDateFor(id);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_follow_up", {
    p_follow_up_id: id,
    p_outcome: parsed.data.outcome,
    p_next_due_date: next,
    p_version: version,
  });
  return parseRpc("complete", data, error);
}

export async function cancelFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const parsed = cancelFollowUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const next = parsed.data.scope === "occurrence" ? await nextDateFor(id) : null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_follow_up", {
    p_follow_up_id: id,
    p_reason: parsed.data.reason,
    p_scope: parsed.data.scope,
    p_next_due_date: next,
    p_version: version,
  });
  return parseRpc("cancel", data, error);
}

export async function reopenFollowUp(id: string, version: number): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reopen_follow_up", {
    p_follow_up_id: id,
    p_version: version,
  });
  return parseRpc("reopen", data, error);
}
