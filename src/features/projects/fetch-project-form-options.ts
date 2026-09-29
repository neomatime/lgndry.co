import "server-only";

import { cache } from "react";
import { projectDetailToInput } from "@/features/projects/detail-view-model";
import { fetchProjectDetail } from "@/features/projects/fetch-project-detail";
import type { ProjectClientOption, ProjectInput } from "@/features/projects/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClientRecord = { id: string; name: string | null };
type ContactRecord = {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_primary: boolean;
};

export async function fetchProjectFormOptions(): Promise<ProjectClientOption[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [clientsResult, contactsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name")
        .eq("archived", false)
        .order("name", { ascending: true }),
      supabase
        .from("client_contacts")
        .select("id, client_id, full_name, email, phone, is_primary")
        .eq("archived", false)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);
    if (clientsResult.error) throw clientsResult.error;
    if (contactsResult.error) throw contactsResult.error;

    const contactsByClient = new Map<string, ContactRecord[]>();
    for (const contact of (contactsResult.data ?? []) as ContactRecord[]) {
      const contacts = contactsByClient.get(contact.client_id) ?? [];
      contacts.push(contact);
      contactsByClient.set(contact.client_id, contacts);
    }

    return ((clientsResult.data ?? []) as ClientRecord[]).map((client) => ({
      id: client.id,
      name: client.name ?? "Unnamed client",
      contacts: (contactsByClient.get(client.id) ?? []).map((contact) => ({
        id: contact.id,
        fullName: contact.full_name,
        email: contact.email,
        phone: contact.phone ?? "",
        isPrimary: contact.is_primary,
      })),
    }));
  } catch (error) {
    console.error("Could not load project form options", error);
    return null;
  }
}

export type ProjectFormDataResult =
  | {
      status: "ok";
      clients: ProjectClientOption[];
      project: { id: string; archived: boolean; values: ProjectInput };
    }
  | { status: "not-found" }
  | { status: "error" };

export const fetchProjectFormData = cache(
  async (projectId: string): Promise<ProjectFormDataResult> => {
    if (!UUID_RE.test(projectId)) return { status: "not-found" };

    const [clients, detail] = await Promise.all([
      fetchProjectFormOptions(),
      fetchProjectDetail(projectId),
    ]);
    if (!clients || detail.status === "error") return { status: "error" };
    if (detail.status === "not-found") return { status: "not-found" };
    return {
      status: "ok",
      clients,
      project: {
        id: detail.project.id,
        archived: detail.project.archived,
        values: projectDetailToInput(detail.project),
      },
    };
  },
);
