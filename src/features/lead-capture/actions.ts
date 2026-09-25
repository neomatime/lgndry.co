"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/server";
import {
  activityMessage,
  bookingRecords,
  contactLead,
  partnershipRecords,
} from "@/features/lead-capture/records";
import {
  bookingSchema,
  contactLeadSchema,
  partnershipSchema,
} from "@/features/lead-capture/schemas";

export type LeadResult = { ok: true } | { ok: false; error: string };

const INVALID: LeadResult = {
  ok: false,
  error: "Some details look incomplete. Please check the form and try again.",
};
const FAILED: LeadResult = {
  ok: false,
  error: "We couldn't send that just now. Please try again in a moment.",
};

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Inserts the rows in order and stops at the first failure. Not transactional
 * (same as the legacy site): if the second insert fails the lead client row
 * from the first remains, which is harmless — it's still a real lead.
 */
async function insertRow(supabase: Supabase, table: string, row: object): Promise<boolean> {
  const { error } = await supabase.from(table).insert(row);
  if (error) console.error(`lead-capture: insert into ${table} failed:`, error.message);
  return !error;
}

/** Activity-log failures never fail the submission: the lead itself was saved. */
async function logActivity(supabase: Supabase, message: string) {
  await insertRow(supabase, "ops_activity_log", { message: activityMessage(message) });
}

function parse<S extends z.ZodType>(schema: S, payload: unknown) {
  const result = schema.safeParse(payload);
  return result.success ? result.data : null;
}

export async function submitContactLead(payload: unknown): Promise<LeadResult> {
  const input = parse(contactLeadSchema, payload);
  if (!input) return INVALID;
  if (input.hp_website) return { ok: true }; // bot: pretend it worked, store nothing

  const supabase = await createSupabaseServerClient();
  const { client, activity } = contactLead(input, crypto.randomUUID());
  if (!(await insertRow(supabase, "clients", client))) return FAILED;
  await logActivity(supabase, activity);
  return { ok: true };
}

export async function submitBooking(payload: unknown): Promise<LeadResult> {
  const input = parse(bookingSchema, payload);
  if (!input) return INVALID;
  if (input.hp_website) return { ok: true };

  const supabase = await createSupabaseServerClient();
  const { client, booking, activity } = bookingRecords(input, crypto.randomUUID());
  if (!(await insertRow(supabase, "clients", client))) return FAILED;
  if (!(await insertRow(supabase, "bookings", booking))) return FAILED;
  await logActivity(supabase, activity);
  return { ok: true };
}

export async function submitPartnership(payload: unknown): Promise<LeadResult> {
  const input = parse(partnershipSchema, payload);
  if (!input) return INVALID;
  if (input.hp_website) return { ok: true };

  const supabase = await createSupabaseServerClient();
  const { client, partnership, activity } = partnershipRecords(input, crypto.randomUUID());
  if (!(await insertRow(supabase, "clients", client))) return FAILED;
  if (!(await insertRow(supabase, "partnerships", partnership))) return FAILED;
  await logActivity(supabase, activity);
  return { ok: true };
}
