import "server-only";

import { createSupabaseServerClient } from "@/lib/db/server";

export type LinkedArchivedStatus = {
  client: boolean;
  contact: boolean;
  enquiry: boolean;
  project: boolean;
};

export const NONE_ARCHIVED: LinkedArchivedStatus = {
  client: false,
  contact: false,
  enquiry: false,
  project: false,
};

type Ids = { clientId: string; contactId?: string; enquiryId?: string; projectId?: string };

/**
 * Which of a follow-up's linked records have since been archived. The follow-up keeps its
 * links to archived records (the spec says to label them, not drop them), but the shared
 * follow-up select does not carry the flag, so the detail page asks for it here.
 *
 * Best-effort by design: this only adds a label, so a failed lookup is logged and treated as
 * "not archived" rather than taking the whole page down.
 */
export async function fetchLinkedArchived(ids: Ids): Promise<LinkedArchivedStatus> {
  try {
    const supabase = await createSupabaseServerClient();
    const check = async (table: string, id: string | undefined) => {
      if (!id) return false;
      const { data, error } = await supabase
        .from(table)
        .select("archived")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as { archived?: boolean } | null)?.archived === true;
    };
    const [client, contact, enquiry, project] = await Promise.all([
      check("clients", ids.clientId),
      check("client_contacts", ids.contactId),
      check("enquiries", ids.enquiryId),
      check("projects", ids.projectId),
    ]);
    return { client, contact, enquiry, project };
  } catch (error) {
    console.error("Could not check archived follow-up links", error);
    return NONE_ARCHIVED;
  }
}
