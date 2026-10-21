"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  invoiceInputSchema,
  paymentInputSchema,
  quoteInputSchema,
  type InvoiceInput,
  type QuoteInput,
} from "@/features/invoices/schemas";
import type { CommercialActionResult } from "@/features/invoices/types";
import { money, reference } from "@/features/invoices/view-model";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseAnonClient } from "@/lib/db/anon";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID = z.uuid();
const VERSION = z.number().int().positive();
const FAILED = "We couldn't save this commercial record just now. Please try again.";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

function quotePayload(input: QuoteInput, owner: { name: string; email: string }) {
  return {
    client_id: input.clientId,
    contact_id: input.contactId,
    enquiry_id: input.enquiryId,
    project_id: input.projectId,
    title: input.title,
    overview: input.overview,
    services: input.services,
    location: input.location,
    discount_amount: input.discountAmount,
    retainer_percentage: input.retainerPercentage,
    terms: input.terms,
    owner_name: owner.name,
    owner_email: owner.email,
  };
}

function invoicePayload(input: InvoiceInput, owner: { name: string; email: string }) {
  return {
    client_id: input.clientId,
    contact_id: input.contactId,
    enquiry_id: input.enquiryId,
    project_id: input.projectId,
    title: input.title,
    overview: input.overview,
    notes: input.notes,
    billing_type: input.billingType,
    discount_amount: input.discountAmount,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    owner_name: owner.name,
    owner_email: owner.email,
  };
}

function linePayload(input: QuoteInput | InvoiceInput) {
  return input.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_amount: item.unitAmount,
  }));
}

function parseRpc(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

function rpcResult(data: unknown, idKey: "quote_id" | "invoice_id"): CommercialActionResult {
  const value = parseRpc(data);
  if (!value) return { status: "error", message: FAILED };
  if (value.status === "ok" && typeof value[idKey] === "string") {
    return {
      status: "success",
      id: value[idKey],
      version: typeof value.version === "number" ? value.version : undefined,
    };
  }
  if (value.status === "conflict") {
    return {
      status: "conflict",
      message: "This record changed elsewhere. Reload and try again.",
      version: typeof value.version === "number" ? value.version : undefined,
    };
  }
  if (value.status === "not-found")
    return { status: "not-found", message: "This record no longer exists." };
  if (value.status === "invalid")
    return {
      status: "invalid",
      message:
        typeof value.message === "string" ? value.message : "Check the details and try again.",
    };
  return { status: "error", message: FAILED };
}

export async function createQuote(input: unknown): Promise<CommercialActionResult> {
  const user = await requireOpsUser();
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_commercial_quote", {
      p_quote: quotePayload(parsed.data, user),
      p_items: linePayload(parsed.data),
    });
    if (error) throw error;
    const result = rpcResult(data, "quote_id");
    if (result.status === "success") revalidatePath("/ops/invoices/quotes");
    return result;
  } catch (error) {
    console.error("Could not create quote", error);
    return { status: "error", message: FAILED };
  }
}

export async function updateQuote(
  id: unknown,
  input: unknown,
  version: unknown,
): Promise<CommercialActionResult> {
  const user = await requireOpsUser();
  void user;
  const parsed = quoteInputSchema.safeParse(input);
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_commercial_quote", {
      p_quote_id: id as string,
      p_quote: quotePayload(parsed.data, user),
      p_items: linePayload(parsed.data),
      p_expected_version: version as number,
    });
    if (error) throw error;
    const value = parseRpc(data);
    if (value?.status === "ok") {
      revalidatePath(`/ops/invoices/quotes/${id}`);
      revalidatePath("/ops/invoices/quotes");
      return {
        status: "success",
        id: id as string,
        version: typeof value.version === "number" ? value.version : undefined,
      };
    }
    return rpcResult(data, "quote_id");
  } catch (error) {
    console.error("Could not update quote", id, error);
    return { status: "error", message: FAILED };
  }
}

export async function reviseQuote(id: unknown, version: unknown): Promise<CommercialActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("revise_commercial_quote", {
      p_quote_id: id as string,
      p_expected_version: version as number,
    });
    if (error) throw error;
    const result = rpcResult(data, "quote_id");
    if (result.status === "success") {
      revalidatePath(`/ops/invoices/quotes/${id}`);
      revalidatePath("/ops/invoices/quotes");
    }
    return result;
  } catch (error) {
    console.error("Could not revise quote", id, error);
    return { status: "error", message: FAILED };
  }
}

export async function sendQuote(id: unknown, version: unknown): Promise<CommercialActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("issue_commercial_quote", {
      p_quote_id: id as string,
      p_token_hash: tokenHash,
      p_expected_version: version as number,
    });
    if (error) throw error;
    const value = parseRpc(data);
    if (value?.status !== "ok") return rpcResult(data, "quote_id");

    const [quoteResult, settingsResult] = await Promise.all([
      supabase
        .from("commercial_quotes")
        .select(
          "reference_number,created_at,title,total,contact:client_contacts!commercial_quotes_contact_id_fkey(full_name,email)",
        )
        .eq("id", id as string)
        .single(),
      supabase.from("ops_settings").select("website_url,sender_name").single(),
    ]);
    if (quoteResult.error) throw quoteResult.error;
    if (settingsResult.error) throw settingsResult.error;
    const quote = quoteResult.data as unknown as {
      reference_number: number;
      created_at: string;
      title: string;
      total: number;
      contact: { full_name: string; email: string };
    };
    const contact = quote.contact;
    const baseUrl = (settingsResult.data.website_url || "https://www.lgndry-co.co.za").replace(
      /\/$/,
      "",
    );
    const approvalUrl = `${baseUrl}/quote/${token}`;
    const quoteRef = reference("QT", Number(quote.reference_number), quote.created_at);
    const text = `Hello ${contact.full_name},\n\nYour ${quoteRef} for ${quote.title} is ready. Total: ${money(Number(quote.total))}.\n\nReview and approve it here: ${approvalUrl}\n\nRegards,\n${settingsResult.data.sender_name}`;
    const html = `<p>Hello ${contact.full_name},</p><p>Your <strong>${quoteRef}</strong> for <strong>${quote.title}</strong> is ready.</p><p>Total: <strong>${money(Number(quote.total))}</strong></p><p><a href="${approvalUrl}" style="display:inline-block;background:#111110;color:#fff;padding:12px 18px;text-decoration:none">Review and Approve Quote</a></p><p>Regards,<br>${settingsResult.data.sender_name}</p>`;
    const email = await supabase.functions.invoke("send-admin-email", {
      body: { to: contact.email, subject: `${quoteRef} · ${quote.title}`, text, html },
    });
    if (email.error) {
      console.error("Quote issued but email delivery failed", email.error);
      return {
        status: "error",
        message:
          "The quote was issued, but the email could not be delivered. Open it and send it again.",
      };
    }
    revalidatePath(`/ops/invoices/quotes/${id}`);
    revalidatePath("/ops/invoices/quotes");
    return {
      status: "success",
      id: id as string,
      version: typeof value.version === "number" ? value.version : undefined,
    };
  } catch (error) {
    console.error("Could not send quote", id, error);
    return { status: "error", message: FAILED };
  }
}

export async function approvePublicQuote(
  token: string,
): Promise<{ status: "success" | "expired" | "error" }> {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) return { status: "error" };
  try {
    const hash = createHash("sha256").update(token).digest("hex");
    const { data, error } = await createSupabaseAnonClient().rpc(
      "approve_public_commercial_quote",
      { p_token_hash: hash },
    );
    if (error) throw error;
    const value = parseRpc(data);
    if (value?.status === "ok") return { status: "success" };
    if (value?.status === "expired") return { status: "expired" };
    return { status: "error" };
  } catch (error) {
    console.error("Could not approve public quote", error);
    return { status: "error" };
  }
}

export async function createInvoice(input: unknown): Promise<CommercialActionResult> {
  const user = await requireOpsUser();
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_commercial_invoice", {
      p_invoice: invoicePayload(parsed.data, user),
      p_items: linePayload(parsed.data),
    });
    if (error) throw error;
    const result = rpcResult(data, "invoice_id");
    if (result.status === "success") revalidatePath("/ops/invoices");
    return result;
  } catch (error) {
    console.error("Could not create invoice", error);
    return { status: "error", message: FAILED };
  }
}

export async function updateInvoice(
  id: unknown,
  input: unknown,
  version: unknown,
): Promise<CommercialActionResult> {
  const user = await requireOpsUser();
  const parsed = invoiceInputSchema.safeParse(input);
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_commercial_invoice", {
      p_invoice_id: id as string,
      p_invoice: invoicePayload(parsed.data, user),
      p_items: linePayload(parsed.data),
      p_expected_version: version as number,
    });
    if (error) throw error;
    const result = rpcResult(data, "invoice_id");
    if (result.status === "success") {
      revalidatePath(`/ops/invoices/${id}`);
      revalidatePath("/ops/invoices");
    }
    return result;
  } catch (error) {
    console.error("Could not update invoice", id, error);
    return { status: "error", message: FAILED };
  }
}

export async function sendInvoice(id: unknown, version: unknown): Promise<CommercialActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("send_commercial_invoice", {
      p_invoice_id: id as string,
      p_expected_version: version as number,
    });
    if (error) throw error;
    const value = parseRpc(data);
    if (value?.status !== "ok") return rpcResult(data, "invoice_id");
    const { data: invoice, error: invoiceError } = await supabase
      .from("commercial_invoices")
      .select(
        "reference_number,created_at,title,total,due_date,payment_snapshot,contact:client_contacts!commercial_invoices_contact_id_fkey(full_name,email)",
      )
      .eq("id", id as string)
      .single();
    if (invoiceError) throw invoiceError;
    const row = invoice as unknown as {
      reference_number: number;
      created_at: string;
      title: string;
      total: number;
      due_date: string;
      payment_snapshot: Record<string, string> | null;
      contact: { full_name: string; email: string };
    };
    const invoiceRef = reference("INV", Number(row.reference_number), row.created_at);
    const payment = row.payment_snapshot ?? {};
    const text = `Hello ${row.contact.full_name},\n\n${invoiceRef} for ${row.title} is ready. Amount: ${money(Number(row.total))}. Due: ${row.due_date}.\n\nBank: ${payment.bank_name || ""}\nAccount holder: ${payment.account_holder || ""}\nAccount number: ${payment.account_number || ""}\nBranch code: ${payment.branch_code || ""}\nReference: ${invoiceRef}\n\nRegards,\nLGNDRY.Co`;
    const email = await supabase.functions.invoke("send-admin-email", {
      body: { to: row.contact.email, subject: `${invoiceRef} · ${row.title}`, text },
    });
    if (email.error)
      return {
        status: "error",
        message: "The invoice was issued, but the email could not be delivered. Try Send again.",
      };
    revalidatePath(`/ops/invoices/${id}`);
    revalidatePath("/ops/invoices");
    return {
      status: "success",
      id: id as string,
      version: typeof value.version === "number" ? value.version : undefined,
    };
  } catch (error) {
    console.error("Could not send invoice", id, error);
    return { status: "error", message: FAILED };
  }
}

export async function recordPayment(
  id: unknown,
  input: unknown,
  version: unknown,
): Promise<CommercialActionResult> {
  const user = await requireOpsUser();
  const parsed = paymentInputSchema.safeParse(input);
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Check the payment details.",
      fieldErrors: fieldErrors(parsed.error),
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("record_commercial_payment", {
      p_invoice_id: id as string,
      p_payment: {
        amount: parsed.data.amount,
        paid_on: parsed.data.paidOn,
        method: parsed.data.method,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
      },
      p_expected_version: version as number,
      p_recorder_name: user.name,
    });
    if (error) throw error;
    const value = parseRpc(data);
    if (value?.status === "ok") {
      revalidatePath(`/ops/invoices/${id}`);
      revalidatePath("/ops/invoices");
      revalidatePath("/ops/projects");
      revalidatePath("/ops/enquiries");
      return {
        status: "success",
        id: id as string,
        version: typeof value.version === "number" ? value.version : undefined,
        projectId: typeof value.project_id === "string" ? value.project_id : null,
      };
    }
    return rpcResult(data, "invoice_id");
  } catch (error) {
    console.error("Could not record payment", id, error);
    return { status: "error", message: FAILED };
  }
}

export async function voidInvoice(id: unknown, version: unknown): Promise<CommercialActionResult> {
  await requireOpsUser();
  if (!UUID.safeParse(id).success || !VERSION.safeParse(version).success)
    return { status: "error", message: FAILED };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("void_commercial_invoice", {
      p_invoice_id: id as string,
      p_expected_version: version as number,
    });
    if (error) throw error;
    const value = parseRpc(data);
    if (value?.status === "ok") {
      revalidatePath(`/ops/invoices/${id}`);
      revalidatePath("/ops/invoices");
      return {
        status: "success",
        id: id as string,
        version: typeof value.version === "number" ? value.version : undefined,
      };
    }
    return rpcResult(data, "invoice_id");
  } catch (error) {
    console.error("Could not void invoice", id, error);
    return { status: "error", message: FAILED };
  }
}
