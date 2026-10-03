import "server-only";

import { cache } from "react";
import { followUpDetailToInput } from "@/features/follow-ups/detail-view-model";
import { fetchFollowUpDetail } from "@/features/follow-ups/fetch-follow-up-detail";
import { projectLabel } from "@/features/follow-ups/list-view-model";
import type { FollowUpClientOption, FollowUpInput } from "@/features/follow-ups/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

export async function fetchFollowUpFormOptions(): Promise<FollowUpClientOption[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [clients, contacts, enquiries, projects] = await Promise.all([
      supabase.from("clients").select("id, name").eq("archived", false).order("name"),
      supabase
        .from("client_contacts")
        .select("id, client_id, full_name, email, phone, role_title")
        .eq("archived", false)
        .order("full_name"),
      supabase
        .from("enquiries")
        .select("id, client_id, project_type, created_at")
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, client, name").eq("archived", false).order("name"),
    ]);
    for (const result of [clients, contacts, enquiries, projects]) {
      if (result.error) throw result.error;
    }
    return ((clients.data ?? []) as Row[]).map((client) => ({
      id: String(client.id),
      name: String(client.name ?? "Unnamed client"),
      contacts: ((contacts.data ?? []) as Row[])
        .filter((contact) => contact.client_id === client.id)
        .map((contact) => ({
          id: String(contact.id),
          fullName: String(contact.full_name),
          email: String(contact.email),
          phone: String(contact.phone ?? ""),
          role: String(contact.role_title ?? ""),
        })),
      enquiries: ((enquiries.data ?? []) as Row[])
        .filter((enquiry) => enquiry.client_id === client.id)
        .map((enquiry) => ({
          id: String(enquiry.id),
          label: `${String(enquiry.project_type)} · ${String(enquiry.id).slice(0, 8).toUpperCase()}`,
        })),
      projects: ((projects.data ?? []) as Row[])
        .filter((project) => project.client === client.id)
        .map((project) => ({ id: String(project.id), label: projectLabel(project.name) })),
    }));
  } catch (error) {
    console.error("Could not load follow-up form options", error);
    return null;
  }
}

export type FollowUpFormDataResult =
  | {
      status: "ok";
      clients: FollowUpClientOption[];
      followUp: { id: string; version: number; values: FollowUpInput };
    }
  | { status: "not-found" }
  | { status: "error" };

export const fetchFollowUpFormData = cache(async (id: string): Promise<FollowUpFormDataResult> => {
  if (!UUID_RE.test(id)) return { status: "not-found" };
  const [clients, detail] = await Promise.all([
    fetchFollowUpFormOptions(),
    fetchFollowUpDetail(id),
  ]);
  if (!clients || detail.status === "error") return { status: "error" };
  if (detail.status === "not-found") return { status: "not-found" };
  return {
    status: "ok",
    clients,
    followUp: {
      id: detail.followUp.id,
      version: detail.followUp.version,
      values: followUpDetailToInput(detail.followUp),
    },
  };
});
