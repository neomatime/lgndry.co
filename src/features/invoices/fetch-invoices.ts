import "server-only";
import type { InvoiceListItem, InvoiceStatus, BillingType } from "@/features/invoices/types";
import { invoiceDisplayStatus, reference } from "@/features/invoices/view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

type InvoiceRow = {
  id: string;
  reference_number: number;
  title: string;
  billing_type: BillingType;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  total: number;
  paid_amount: number;
  owner_user_id: string | null;
  owner_name: string;
  owner_email: string;
  version: number;
  created_at: string;
  project_id: string | null;
  client: { id: string; name: string | null } | null;
  contact: { id: string; full_name: string } | null;
  project: { id: string; name: string } | null;
};

export async function fetchInvoices(today: string): Promise<InvoiceListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("commercial_invoices")
      .select(
        "id, reference_number, title, billing_type, status, issue_date, due_date, paid_at, total, paid_amount, owner_user_id, owner_name, owner_email, version, created_at, project_id, client:clients!commercial_invoices_client_id_fkey(id,name), contact:client_contacts!commercial_invoices_contact_id_fkey(id,full_name), project:projects!commercial_invoices_project_id_fkey(id,name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as InvoiceRow[]).map((row) => {
      const status = row.status as InvoiceStatus;
      const total = Number(row.total);
      const paid = Number(row.paid_amount);
      return {
        id: row.id,
        reference: reference("INV", Number(row.reference_number), row.created_at),
        clientId: row.client?.id ?? "",
        clientName: row.client?.name ?? "Unnamed client",
        contactName: row.contact?.full_name ?? "Unknown contact",
        projectId: row.project_id,
        projectName: row.project?.name ?? null,
        title: row.title,
        billingType: row.billing_type as BillingType,
        status,
        displayStatus: invoiceDisplayStatus(status, paid, total, row.due_date ?? "", today),
        issueDate: row.issue_date ?? "",
        dueDate: row.due_date ?? "",
        paidAt: row.paid_at ?? "",
        total,
        paidAmount: paid,
        outstanding: Math.max(0, total - paid),
        owner: { id: row.owner_user_id, name: row.owner_name, email: row.owner_email },
        version: row.version,
        createdAt: row.created_at,
      } satisfies InvoiceListItem;
    });
  } catch (error) {
    console.error("Could not load invoices", error);
    return null;
  }
}
