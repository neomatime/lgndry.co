import "server-only";
import { cache } from "react";
import type {
  BillingType,
  InvoiceDetail,
  InvoiceStatus,
  PaymentMethod,
} from "@/features/invoices/types";
import { invoiceDisplayStatus, reference } from "@/features/invoices/view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type InvoiceDetailResult =
  { status: "ok"; invoice: InvoiceDetail } | { status: "not-found" } | { status: "error" };

type InvoiceLineRecord = {
  id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
  sort_order: number;
};
type PaymentRecord = {
  id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  recorded_by_name: string;
  created_at: string;
};
type InvoiceDetailRecord = {
  id: string;
  reference_number: number;
  quote_id: string | null;
  client_id: string;
  contact_id: string;
  enquiry_id: string | null;
  project_id: string | null;
  title: string;
  overview: string | null;
  notes: string | null;
  billing_type: BillingType;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  company_snapshot: Record<string, string> | null;
  payment_snapshot: Record<string, string> | null;
  terms_snapshot: string | null;
  owner_user_id: string | null;
  owner_name: string;
  owner_email: string;
  version: number;
  created_at: string;
  client: { name: string | null } | null;
  contact: { full_name: string; email: string; phone: string | null } | null;
  project: { name: string } | null;
  quote: { reference_number: number; created_at: string } | null;
  commercial_invoice_line_items: InvoiceLineRecord[] | null;
  commercial_payments: PaymentRecord[] | null;
};
type ActivityRecord = { id: string; message: string; action: string | null; created_at: string };

export const fetchInvoiceDetail = cache(
  async (id: string, today: string): Promise<InvoiceDetailResult> => {
    if (!UUID.test(id)) return { status: "not-found" };
    try {
      const supabase = await createSupabaseServerClient();
      const [invoiceResult, activityResult] = await Promise.all([
        supabase
          .from("commercial_invoices")
          .select(
            "id, reference_number, quote_id, client_id, contact_id, enquiry_id, project_id, title, overview, notes, billing_type, status, currency, subtotal, discount_amount, total, paid_amount, issue_date, due_date, paid_at, company_snapshot, payment_snapshot, terms_snapshot, owner_user_id, owner_name, owner_email, version, created_at, client:clients!commercial_invoices_client_id_fkey(id,name), contact:client_contacts!commercial_invoices_contact_id_fkey(id,full_name,email,phone), project:projects!commercial_invoices_project_id_fkey(id,name), quote:commercial_quotes!commercial_invoices_quote_id_fkey(reference_number,created_at), commercial_invoice_line_items(id,description,quantity,unit_amount,line_total,sort_order), commercial_payments(id,amount,paid_on,method,reference,notes,recorded_by_name,created_at)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("ops_activity_log")
          .select("id,message,action,created_at")
          .eq("collection", "commercial_invoices")
          .eq("record_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (invoiceResult.error) throw invoiceResult.error;
      if (activityResult.error) throw activityResult.error;
      if (!invoiceResult.data) return { status: "not-found" };
      const row = invoiceResult.data as unknown as InvoiceDetailRecord;
      const total = Number(row.total);
      const paid = Number(row.paid_amount);
      const status = row.status as InvoiceStatus;
      return {
        status: "ok",
        invoice: {
          id: row.id,
          reference: reference("INV", Number(row.reference_number), row.created_at),
          clientId: row.client_id,
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
          quoteId: row.quote_id,
          quoteReference: row.quote
            ? reference("QT", Number(row.quote.reference_number), row.quote.created_at)
            : null,
          enquiryId: row.enquiry_id,
          contactId: row.contact_id,
          subtotal: Number(row.subtotal),
          discountAmount: Number(row.discount_amount),
          overview: row.overview ?? "",
          notes: row.notes ?? "",
          currency: "ZAR",
          companySnapshot: row.company_snapshot ?? {},
          paymentSnapshot: row.payment_snapshot ?? {},
          terms: row.terms_snapshot ?? "",
          contact: {
            id: row.contact_id,
            name: row.contact?.full_name ?? "Unknown contact",
            email: row.contact?.email ?? "",
            phone: row.contact?.phone ?? "",
          },
          lineItems: (row.commercial_invoice_line_items ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity),
              unitAmount: Number(item.unit_amount),
              lineTotal: Number(item.line_total),
            })),
          payments: (row.commercial_payments ?? [])
            .sort((a, b) => a.paid_on.localeCompare(b.paid_on))
            .map((payment) => ({
              id: payment.id,
              amount: Number(payment.amount),
              paidOn: payment.paid_on,
              method: payment.method as PaymentMethod,
              reference: payment.reference ?? "",
              notes: payment.notes ?? "",
              recordedByName: payment.recorded_by_name,
              createdAt: payment.created_at,
            })),
          activity: ((activityResult.data ?? []) as unknown as ActivityRecord[]).map(
            (activity) => ({
              id: activity.id,
              message: activity.message,
              action: activity.action ?? "",
              createdAt: activity.created_at,
            }),
          ),
        },
      };
    } catch (error) {
      console.error("Could not load invoice", id, error);
      return { status: "error" };
    }
  },
);
