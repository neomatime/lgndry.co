"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clientInputSchema, type ParsedClientInput } from "@/features/clients/schemas";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

export type ClientActionResult =
  | { status: "success"; clientId: string }
  | { status: "invalid"; fieldErrors: Record<string, string[]>; error: string }
  | { status: "conflict"; clientId: string; error: string }
  | { status: "error"; error: string };

const rpcResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), client_id: z.uuid() }),
  z.object({ status: z.literal("conflict"), client_id: z.uuid() }),
]);
const UUID = z.uuid();
const FAILED = "We couldn't save this client just now. Please try again.";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

function payload(input: ParsedClientInput) {
  return {
    client: {
      name: input.name,
      type: input.type,
      status: input.status,
      account_tier: input.accountTier,
      industry: input.industry,
      region: input.region,
      client_since: input.clientSince,
      account_overview: input.accountOverview,
      preferred_services: input.preferredServices,
      relationship_notes: input.relationshipNotes,
    },
    contacts: input.contacts.map((contact) => ({
      id: contact.id,
      full_name: contact.fullName,
      role_title: contact.roleTitle,
      email: contact.email,
      phone: contact.phone,
      is_primary: contact.isPrimary,
    })),
  };
}

async function parseRpc(
  operation: string,
  data: unknown,
  error: { message?: string } | null,
): Promise<ClientActionResult> {
  if (error) {
    console.error(`clients: ${operation} failed`, error.message ?? "database error");
    return { status: "error", error: FAILED };
  }
  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`clients: ${operation} returned an invalid response`);
    return { status: "error", error: FAILED };
  }
  if (parsed.data.status === "conflict") {
    return {
      status: "conflict",
      clientId: parsed.data.client_id,
      error: "That email belongs to another active client.",
    };
  }
  revalidatePath("/ops/clients");
  revalidatePath(`/ops/clients/${parsed.data.client_id}`);
  return { status: "success", clientId: parsed.data.client_id };
}

export async function createClient(input: unknown): Promise<ClientActionResult> {
  await requireOpsUser();
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrors(parsed.error),
      error: "Check the highlighted client details and try again.",
    };
  }
  const supabase = await createSupabaseServerClient();
  const shaped = payload(parsed.data);
  const { data, error } = await supabase.rpc("create_client_with_contacts", {
    p_client: shaped.client,
    p_contacts: shaped.contacts,
  });
  return parseRpc("create", data, error);
}

export async function updateClient(id: string, input: unknown): Promise<ClientActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", error: FAILED };
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrors(parsed.error),
      error: "Check the highlighted client details and try again.",
    };
  }
  const supabase = await createSupabaseServerClient();
  const shaped = payload(parsed.data);
  const { data, error } = await supabase.rpc("update_client_with_contacts", {
    p_client_id: id,
    p_client: shaped.client,
    p_contacts: shaped.contacts,
  });
  return parseRpc("update", data, error);
}

export async function setClientArchived(
  id: string,
  archived: boolean,
): Promise<ClientActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success) return { status: "error", error: FAILED };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_client_archived", {
    p_client_id: id,
    p_archived: archived,
  });
  return parseRpc(archived ? "archive" : "restore", data, error);
}
