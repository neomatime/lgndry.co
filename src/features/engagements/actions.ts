"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";
import { bookingEditSchema, partnershipEditSchema } from "./schemas";
import { BOOKING_STATUSES, PARTNERSHIP_STATUSES } from "./types";

export type EngagementActionResult =
  | { status: "success"; version: number }
  | { status: "invalid"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "conflict"; message: string; version: number }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const UUID = z.uuid();
const FAILED = "We couldn't save this record just now. Please try again.";
const rpcSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), record_id: z.uuid(), version: z.number() }),
  z.object({ status: z.literal("not-found") }),
  z.object({ status: z.literal("conflict"), version: z.number() }),
  z.object({ status: z.literal("invalid"), message: z.string().optional() }),
]);

function errorsFor(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues)
    (fields[issue.path.join(".") || "form"] ??= []).push(issue.message);
  return fields;
}

function refresh(id: string, kind: "bookings" | "partnerships") {
  revalidatePath("/ops/engagements");
  revalidatePath(`/ops/engagements/${kind}/${id}`);
  revalidatePath("/ops");
}

function result(
  operation: string,
  id: string,
  kind: "bookings" | "partnerships",
  data: unknown,
  error: { message?: string } | null,
): EngagementActionResult {
  if (error) {
    console.error(`engagements: ${operation} failed`, error.message ?? "database error");
    return { status: "error", message: FAILED };
  }
  const parsed = rpcSchema.safeParse(data);
  if (!parsed.success) return { status: "error", message: FAILED };
  if (parsed.data.status === "not-found")
    return { status: "not-found", message: "That record is no longer available." };
  if (parsed.data.status === "conflict")
    return {
      status: "conflict",
      version: parsed.data.version,
      message: "This record changed in another session. Refresh and try again.",
    };
  if (parsed.data.status === "invalid")
    return {
      status: "invalid",
      message: parsed.data.message ?? "Check the details and try again.",
    };
  refresh(id, kind);
  return { status: "success", version: parsed.data.version };
}

export async function updateBooking(id: string, input: unknown): Promise<EngagementActionResult> {
  const user = await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const parsed = bookingEditSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the highlighted booking details.",
      fieldErrors: errorsFor(parsed.error),
    };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_booking_request", {
    p_booking_id: id,
    p_expected_version: parsed.data.version,
    p_request: {
      service: parsed.data.service,
      services: parsed.data.services,
      date: parsed.data.date,
      start: parsed.data.start,
      location: parsed.data.location,
      project_details: parsed.data.projectDetails,
      date_flexibility: parsed.data.dateFlexibility,
      budget_range: parsed.data.budgetRange,
      owner_name: user.name,
      owner_email: user.email,
    },
  });
  return result("booking update", id, "bookings", data, error);
}

export async function setBookingStatus(
  id: string,
  status: unknown,
  version: number,
): Promise<EngagementActionResult> {
  const user = await requireOpsUser();
  const parsed = z
    .object({ id: UUID, status: z.enum(BOOKING_STATUSES), version: z.number().int().positive() })
    .safeParse({ id, status, version });
  if (!parsed.success) return { status: "invalid", message: "Choose a valid booking status." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_booking_request_status", {
    p_booking_id: id,
    p_status: parsed.data.status,
    p_expected_version: parsed.data.version,
    p_owner_name: user.name,
    p_owner_email: user.email,
  });
  return result("booking status update", id, "bookings", data, error);
}

export async function updatePartnership(
  id: string,
  input: unknown,
): Promise<EngagementActionResult> {
  const user = await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", message: FAILED };
  const parsed = partnershipEditSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the highlighted partnership details.",
      fieldErrors: errorsFor(parsed.error),
    };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_partnership_request", {
    p_partnership_id: id,
    p_expected_version: parsed.data.version,
    p_request: {
      partnership_type: parsed.data.partnershipType,
      focus_areas: parsed.data.focusAreas,
      brand_goals: parsed.data.brandGoals,
      industry: parsed.data.industry,
      brand_link: parsed.data.brandLink,
      brand_location: parsed.data.brandLocation,
      content_frequency: parsed.data.contentFrequency,
      budget_range: parsed.data.budgetRange,
      owner_name: user.name,
      owner_email: user.email,
    },
  });
  return result("partnership update", id, "partnerships", data, error);
}

export async function setPartnershipStatus(
  id: string,
  status: unknown,
  version: number,
): Promise<EngagementActionResult> {
  const user = await requireOpsUser();
  const parsed = z
    .object({
      id: UUID,
      status: z.enum(PARTNERSHIP_STATUSES),
      version: z.number().int().positive(),
    })
    .safeParse({ id, status, version });
  if (!parsed.success) return { status: "invalid", message: "Choose a valid partnership status." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_partnership_request_status", {
    p_partnership_id: id,
    p_status: parsed.data.status,
    p_expected_version: parsed.data.version,
    p_owner_name: user.name,
    p_owner_email: user.email,
  });
  return result("partnership status update", id, "partnerships", data, error);
}
