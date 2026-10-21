import "server-only";
import type { QuoteListItem, QuoteStatus } from "@/features/invoices/types";
import { reference } from "@/features/invoices/view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

type QuoteRow = {
  id: string;
  reference_number: number;
  revision: number;
  title: string;
  status: QuoteStatus;
  total: number;
  valid_until: string | null;
  owner_user_id: string | null;
  owner_name: string;
  owner_email: string;
  version: number;
  created_at: string;
  client: { id: string; name: string | null } | null;
  contact: { full_name: string } | null;
};

export async function fetchQuotes(): Promise<QuoteListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("commercial_quotes")
      .select(
        "id, reference_number, revision, title, status, total, valid_until, owner_user_id, owner_name, owner_email, version, created_at, client:clients!commercial_quotes_client_id_fkey(id,name), contact:client_contacts!commercial_quotes_contact_id_fkey(id,full_name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as QuoteRow[]).map((row) => ({
      id: row.id,
      reference: reference("QT", Number(row.reference_number), row.created_at),
      revision: row.revision,
      clientId: row.client?.id ?? "",
      clientName: row.client?.name ?? "Unnamed client",
      contactName: row.contact?.full_name ?? "Unknown contact",
      title: row.title,
      status: row.status as QuoteStatus,
      total: Number(row.total),
      validUntil: row.valid_until ?? "",
      owner: { id: row.owner_user_id, name: row.owner_name, email: row.owner_email },
      version: row.version,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Could not load quotes", error);
    return null;
  }
}
