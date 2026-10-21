import "server-only";
import type { CommercialFormData } from "@/features/invoices/types";
import { createSupabaseServerClient } from "@/lib/db/server";

type ContactRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  archived: boolean;
};
type RelatedRecord = { id: string; archived: boolean };
type ClientRecord = {
  id: string;
  name: string | null;
  client_contacts: ContactRecord[] | null;
  enquiries: (RelatedRecord & { project_type: string; status: string })[] | null;
  projects: (RelatedRecord & { name: string })[] | null;
};

export async function fetchCommercialFormData(): Promise<CommercialFormData | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [clientsResult, settingsResult] = await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, name, client_contacts(id, full_name, email, phone, archived), enquiries(id, project_type, status, archived), projects(id, name, archived)",
        )
        .eq("archived", false)
        .order("name"),
      supabase
        .from("ops_settings")
        .select("default_quote_terms, default_retainer_percentage, default_deposit_due_days")
        .single(),
    ]);
    if (clientsResult.error) throw clientsResult.error;
    if (settingsResult.error) throw settingsResult.error;
    return {
      clients: ((clientsResult.data ?? []) as unknown as ClientRecord[]).map((client) => ({
        id: client.id,
        name: client.name || "Unnamed client",
        contacts: (client.client_contacts ?? [])
          .filter((contact) => !contact.archived)
          .map((contact) => ({
            id: contact.id,
            name: contact.full_name,
            email: contact.email,
            phone: contact.phone ?? "",
          })),
        enquiries: (client.enquiries ?? [])
          .filter(
            (enquiry) => !enquiry.archived && !["Completed", "Closed"].includes(enquiry.status),
          )
          .map((enquiry) => ({ id: enquiry.id, label: enquiry.project_type })),
        projects: (client.projects ?? [])
          .filter((project) => !project.archived)
          .map((project) => ({ id: project.id, label: project.name })),
      })),
      defaults: {
        terms: settingsResult.data.default_quote_terms ?? "",
        retainerPercentage: Number(settingsResult.data.default_retainer_percentage),
        depositDueDays: Number(settingsResult.data.default_deposit_due_days),
      },
    };
  } catch (error) {
    console.error("Could not load commercial form options", error);
    return null;
  }
}
