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

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type RelationIds = { clientId?: string; enquiryId?: string; projectId?: string };

const UUID = z.uuid();
const FAILED = "We couldn't save this follow-up just now. Please try again.";
const NOT_FOUND: FollowUpActionState = {
  status: "not-found",
  message: "That follow-up is no longer available.",
};
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

/**
 * Revalidates the follow-up's own pages plus every linked Client/Enquiry/
 * Project detail page across all given relation sets (e.g. the pre-update
 * and post-update relations for `updateFollowUp`, so relinking a follow-up
 * away from a client also refreshes that OLD client's page). Duplicate
 * paths across sets are only revalidated once.
 */
function revalidateFollowUp(id: string, ...relationSets: Array<RelationIds | undefined>) {
  revalidatePath("/ops/follow-ups");
  revalidatePath(`/ops/follow-ups/${id}`);
  revalidatePath(`/ops/follow-ups/${id}/edit`);
  const seen = new Set<string>();
  for (const relations of relationSets) {
    if (!relations) continue;
    const { clientId, enquiryId, projectId } = relations;
    if (clientId && !seen.has(`client:${clientId}`)) {
      seen.add(`client:${clientId}`);
      revalidatePath(`/ops/clients/${clientId}`);
    }
    if (enquiryId && !seen.has(`enquiry:${enquiryId}`)) {
      seen.add(`enquiry:${enquiryId}`);
      revalidatePath(`/ops/enquiries/${enquiryId}`);
    }
    if (projectId && !seen.has(`project:${projectId}`)) {
      seen.add(`project:${projectId}`);
      revalidatePath(`/ops/projects/${projectId}`);
    }
  }
}

/** Looks up a follow-up's current client/enquiry/project so lifecycle actions
 * that only know an id (not the full relation set) can still revalidate the
 * linked Client/Enquiry/Project detail pages. Best-effort: a lookup failure
 * only means revalidation is skipped, never that the action itself fails. */
async function fetchRelationIds(
  supabase: SupabaseServerClient,
  followUpId: string,
): Promise<RelationIds | undefined> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("client_id, enquiry_id, project_id")
    .eq("id", followUpId)
    .maybeSingle();
  if (error || !data) return undefined;
  return {
    clientId: data.client_id ?? undefined,
    enquiryId: data.enquiry_id ?? undefined,
    projectId: data.project_id ?? undefined,
  };
}

/** Same as `fetchRelationIds`, but starting from a checklist item id rather
 * than the follow-up id directly (`setFollowUpChecklistItem` only receives
 * the item id). */
async function fetchChecklistItemRelationIds(
  supabase: SupabaseServerClient,
  itemId: string,
): Promise<RelationIds | undefined> {
  const { data, error } = await supabase
    .from("follow_up_checklist_items")
    .select("follow_ups(client_id, enquiry_id, project_id)")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) return undefined;
  const followUp = Array.isArray(data.follow_ups) ? data.follow_ups[0] : data.follow_ups;
  if (!followUp) return undefined;
  return {
    clientId: followUp.client_id ?? undefined,
    enquiryId: followUp.enquiry_id ?? undefined,
    projectId: followUp.project_id ?? undefined,
  };
}

function parseRpc(
  operation: string,
  data: unknown,
  error: { message?: string } | null,
  ...relationSets: Array<RelationIds | undefined>
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
  if (parsed.data.status === "not-found") return NOT_FOUND;
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
  revalidateFollowUp(parsed.data.follow_up_id, ...relationSets);
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
  if (!UUID.safeParse(id).success) return NOT_FOUND;
  const parsed = followUpInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const shaped = payload(parsed.data);
  const supabase = await createSupabaseServerClient();
  // Read the pre-update relations so a relink (e.g. moving the follow-up to
  // a different client) also revalidates the OLD client/enquiry/project
  // page, not just the newly selected one.
  const previousRelations = await fetchRelationIds(supabase, id);
  const { data, error } = await supabase.rpc("update_follow_up", {
    p_follow_up_id: id,
    p_follow_up: shaped.followUp,
    p_checklist: shaped.checklist,
    p_recurrence: shaped.recurrence,
    p_scope: parsed.data.editScope,
    p_version: version,
  });
  return parseRpc("update", data, error, previousRelations, {
    clientId: parsed.data.clientId,
    enquiryId: parsed.data.enquiryId,
    projectId: parsed.data.projectId,
  });
}

type NextDateResult = { ok: true; date: string | null } | { ok: false };

/**
 * Looks up the next occurrence date for a follow-up's series (or confirms
 * there is none). Returns a discriminated result so a transient read
 * failure (`ok: false`) can never be mistaken for "this series has
 * genuinely ended" (`ok: true, date: null`) - the two were indistinguishable
 * before, so a flaky read at the wrong moment would pass `null` to
 * complete/cancel and permanently (and silently) deactivate an otherwise
 * active recurring series.
 */
async function nextDateFor(id: string, supabase: SupabaseServerClient): Promise<NextDateResult> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("due_date, series:follow_up_series(recurrence_rule)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error(
      "follow-ups: failed to look up the next occurrence date",
      error.message ?? "database error",
    );
    return { ok: false };
  }
  if (!data) return { ok: false };
  const series = Array.isArray(data.series) ? data.series[0] : data.series;
  const date = series?.recurrence_rule
    ? nextOccurrenceDate(data.due_date, series.recurrence_rule)
    : null;
  return { ok: true, date };
}

export async function setFollowUpChecklistItem(
  itemId: string,
  completed: boolean,
  version: number,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(itemId).success) return NOT_FOUND;
  const supabase = await createSupabaseServerClient();
  const relations = await fetchChecklistItemRelationIds(supabase, itemId);
  const { data, error } = await supabase.rpc("set_follow_up_checklist_item", {
    p_item_id: itemId,
    p_completed: completed,
    p_version: version,
  });
  return parseRpc("checklist", data, error, relations);
}

export async function rescheduleFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return NOT_FOUND;
  const parsed = rescheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const relations = await fetchRelationIds(supabase, id);
  const { data, error } = await supabase.rpc("reschedule_follow_up", {
    p_follow_up_id: id,
    p_due_date: parsed.data.dueDate,
    p_due_time: parsed.data.dueTime || null,
    p_scope: parsed.data.scope,
    p_recurrence: {},
    p_version: version,
  });
  return parseRpc("reschedule", data, error, relations);
}

export async function completeFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return NOT_FOUND;
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const next = await nextDateFor(id, supabase);
  if (!next.ok) return { status: "error", message: FAILED };
  const relations = await fetchRelationIds(supabase, id);
  const { data, error } = await supabase.rpc("complete_follow_up", {
    p_follow_up_id: id,
    p_outcome: parsed.data.outcome,
    p_next_due_date: next.date,
    p_version: version,
  });
  return parseRpc("complete", data, error, relations);
}

export async function cancelFollowUp(
  id: string,
  version: number,
  input: unknown,
): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return NOT_FOUND;
  const parsed = cancelFollowUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  if (parsed.data.scope === "occurrence") {
    const next = await nextDateFor(id, supabase);
    if (!next.ok) return { status: "error", message: FAILED };
    const relations = await fetchRelationIds(supabase, id);
    const { data, error } = await supabase.rpc("cancel_follow_up", {
      p_follow_up_id: id,
      p_reason: parsed.data.reason,
      p_scope: parsed.data.scope,
      p_next_due_date: next.date,
      p_version: version,
    });
    return parseRpc("cancel", data, error, relations);
  }
  const relations = await fetchRelationIds(supabase, id);
  const { data, error } = await supabase.rpc("cancel_follow_up", {
    p_follow_up_id: id,
    p_reason: parsed.data.reason,
    p_scope: parsed.data.scope,
    p_next_due_date: null,
    p_version: version,
  });
  return parseRpc("cancel", data, error, relations);
}

export async function reopenFollowUp(id: string, version: number): Promise<FollowUpActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return NOT_FOUND;
  const supabase = await createSupabaseServerClient();
  const relations = await fetchRelationIds(supabase, id);
  const { data, error } = await supabase.rpc("reopen_follow_up", {
    p_follow_up_id: id,
    p_version: version,
  });
  return parseRpc("reopen", data, error, relations);
}
