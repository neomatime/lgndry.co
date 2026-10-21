import "server-only";
import { cache } from "react";
import type { QuoteDetail, QuoteStatus } from "@/features/invoices/types";
import { reference } from "@/features/invoices/view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type QuoteDetailResult =
  { status: "ok"; quote: QuoteDetail } | { status: "not-found" } | { status: "error" };

type QuoteLineRecord = {
  id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
  sort_order: number;
};
type QuoteDetailRecord = {
  id: string;
  reference_number: number;
  revision: number;
  client_id: string;
  contact_id: string;
  enquiry_id: string | null;
  project_id: string | null;
  title: string;
  overview: string | null;
  services: string[] | null;
  location: string | null;
  status: QuoteStatus;
  subtotal: number;
  discount_amount: number;
  total: number;
  retainer_percentage: number;
  terms: string | null;
  valid_until: string | null;
  approved_at: string | null;
  owner_user_id: string | null;
  owner_name: string;
  owner_email: string;
  version: number;
  created_at: string;
  client: { name: string | null } | null;
  contact: { full_name: string } | null;
  commercial_quote_line_items: QuoteLineRecord[] | null;
};

export const fetchQuoteDetail = cache(async (id: string): Promise<QuoteDetailResult> => {
  if (!UUID.test(id)) return { status: "not-found" };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("commercial_quotes")
      .select(
        "id, reference_number, revision, client_id, contact_id, enquiry_id, project_id, title, overview, services, location, status, currency, subtotal, discount_amount, total, retainer_percentage, terms, valid_until, approved_at, owner_user_id, owner_name, owner_email, version, created_at, client:clients!commercial_quotes_client_id_fkey(id,name), contact:client_contacts!commercial_quotes_contact_id_fkey(id,full_name), commercial_quote_line_items(id,description,quantity,unit_amount,line_total,sort_order)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: "not-found" };
    const row = data as unknown as QuoteDetailRecord;
    return {
      status: "ok",
      quote: {
        id: row.id,
        reference: reference("QT", Number(row.reference_number), row.created_at),
        revision: row.revision,
        clientId: row.client_id,
        clientName: row.client?.name ?? "Unnamed client",
        contactName: row.contact?.full_name ?? "Unknown contact",
        title: row.title,
        status: row.status as QuoteStatus,
        total: Number(row.total),
        validUntil: row.valid_until ?? "",
        owner: { id: row.owner_user_id, name: row.owner_name, email: row.owner_email },
        version: row.version,
        createdAt: row.created_at,
        enquiryId: row.enquiry_id,
        projectId: row.project_id,
        overview: row.overview ?? "",
        services: row.services ?? [],
        location: row.location ?? "",
        currency: "ZAR",
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discount_amount),
        retainerPercentage: Number(row.retainer_percentage),
        terms: row.terms ?? "",
        contactId: row.contact_id,
        approvedAt: row.approved_at ?? "",
        lineItems: (row.commercial_quote_line_items ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({
            id: item.id,
            description: item.description,
            quantity: Number(item.quantity),
            unitAmount: Number(item.unit_amount),
            lineTotal: Number(item.line_total),
          })),
      },
    };
  } catch (error) {
    console.error("Could not load quote", id, error);
    return { status: "error" };
  }
});
