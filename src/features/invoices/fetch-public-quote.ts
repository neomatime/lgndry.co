import "server-only";
import { createHash } from "node:crypto";
import type { PublicQuote, QuoteStatus } from "@/features/invoices/types";
import { reference } from "@/features/invoices/view-model";
import { createSupabaseAnonClient } from "@/lib/db/anon";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type PublicQuoteRecord = {
  reference_number: number;
  revision: number;
  title: string;
  overview: string | null;
  status: QuoteStatus;
  client_name: string;
  contact_name: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  retainer_percentage: number;
  terms: string | null;
  valid_until: string;
  issued_at: string;
  approved_at: string | null;
  company_snapshot: Record<string, string> | null;
  line_items:
    | {
        description: string;
        quantity: number;
        unit_amount: number;
        line_total: number;
      }[]
    | null;
  deposit_invoice: null | {
    reference_number: number;
    total: number;
    paid_amount: number;
    due_date: string;
    status: string;
    payment_snapshot: Record<string, string> | null;
  };
};

export async function fetchPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) return null;
  try {
    const { data, error } = await createSupabaseAnonClient().rpc("get_public_commercial_quote", {
      p_token_hash: hashToken(token),
    });
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as PublicQuoteRecord;
    return {
      reference: reference("QT", Number(row.reference_number), row.issued_at),
      revision: Number(row.revision),
      title: row.title,
      overview: row.overview ?? "",
      status: row.status as QuoteStatus,
      clientName: row.client_name,
      contactName: row.contact_name,
      currency: "ZAR",
      subtotal: Number(row.subtotal),
      discountAmount: Number(row.discount_amount),
      total: Number(row.total),
      retainerPercentage: Number(row.retainer_percentage),
      terms: row.terms ?? "",
      validUntil: row.valid_until,
      issuedAt: row.issued_at,
      approvedAt: row.approved_at ?? "",
      company: row.company_snapshot ?? {},
      lineItems: (row.line_items ?? []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitAmount: Number(item.unit_amount),
        lineTotal: Number(item.line_total),
      })),
      depositInvoice: row.deposit_invoice
        ? {
            reference: reference(
              "INV",
              Number(row.deposit_invoice.reference_number),
              row.approved_at ?? row.issued_at,
            ),
            total: Number(row.deposit_invoice.total),
            paidAmount: Number(row.deposit_invoice.paid_amount),
            dueDate: row.deposit_invoice.due_date,
            status: row.deposit_invoice.status as "Draft" | "Sent" | "Paid" | "Void",
            payment: row.deposit_invoice.payment_snapshot ?? {},
          }
        : null,
    };
  } catch (error) {
    console.error("Could not load public quote", error);
    return null;
  }
}

export { hashToken };
