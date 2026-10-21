import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261020143000_commercial_documents.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

function rpc(name: string) {
  const match = migration.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
  );
  if (!match) throw new Error(`${name} function is missing`);
  return match[0];
}

describe("commercial documents migration", () => {
  it("creates permanent quote, invoice, line-item and payment records", () => {
    expect(migration).toContain("create table public.commercial_quotes");
    expect(migration).toContain("create table public.commercial_quote_line_items");
    expect(migration).toContain("create table public.commercial_invoices");
    expect(migration).toContain("create table public.commercial_invoice_line_items");
    expect(migration).toContain("create table public.commercial_payments");
    expect(migration).toContain("currency text not null default 'ZAR' check (currency = 'ZAR')");
    expect(migration).toContain("commercial_quotes_reference_revision_key");
    expect(migration).toContain("constraint commercial_quotes_amounts_check");
    expect(migration).toContain("constraint commercial_invoices_amounts_check");
    expect(migration).not.toContain("constraint commercial_quotes_total_check");
    expect(migration).not.toContain("constraint commercial_invoices_total_check");
  });

  it("exposes no direct authenticated writes", () => {
    expect(migration).toContain(
      "revoke all on table public.commercial_quotes from public, anon, authenticated, service_role",
    );
    expect(migration).toContain("grant select on table public.commercial_quotes to authenticated");
    expect(migration).not.toContain(
      "grant insert on table public.commercial_quotes to authenticated",
    );
    expect(migration).not.toContain(
      "grant update on table public.commercial_invoices to authenticated",
    );
  });

  it.each([
    "create_commercial_quote",
    "update_commercial_quote",
    "revise_commercial_quote",
    "create_commercial_invoice",
    "update_commercial_invoice",
    "send_commercial_invoice",
    "record_commercial_payment",
    "void_commercial_invoice",
  ])("admin-gates and pins the search path for %s", (name) => {
    const body = rpc(name);
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("public.is_admin(");
  });

  it("uses optimistic locking on every mutable admin record", () => {
    for (const name of [
      "update_commercial_quote",
      "revise_commercial_quote",
      "update_commercial_invoice",
      "send_commercial_invoice",
      "record_commercial_payment",
      "void_commercial_invoice",
    ]) {
      expect(rpc(name)).toContain("version is distinct from p_expected_version");
    }
  });

  it("validates document values again inside PostgreSQL", () => {
    for (const name of ["create_commercial_quote", "update_commercial_quote"]) {
      const body = rpc(name);
      expect(body).toContain("v_retainer <= 0 or v_retainer > 100");
      expect(body).toContain(
        "jsonb_typeof(coalesce(p_quote -> 'services', '[]'::jsonb)) is distinct from 'array'",
      );
      expect(body).toContain("char_length(btrim(p_quote ->> 'title')) > 240");
      expect(body).toContain("v_discount::text in ('NaN', 'Infinity', '-Infinity')");
    }
    for (const name of ["create_commercial_invoice", "update_commercial_invoice"]) {
      const body = rpc(name);
      expect(body).toContain("not in ('Standard', 'Deposit', 'Balance')");
      expect(body).toContain("char_length(btrim(p_invoice ->> 'title')) > 240");
    }
  });

  it("snapshots current commercial settings on first direct-invoice send", () => {
    const body = rpc("send_commercial_invoice");
    expect(body).toContain("v_invoice.status = 'Draft' and v_invoice.quote_id is null");
    expect(body).toContain("Complete the company, banking and sender details in Settings");
    expect(body).toContain("company_snapshot = case");
    expect(body).toContain("payment_snapshot = case");
    expect(body).toContain("terms_snapshot = case");
  });

  it("preserves issued quote snapshots when a quote email is resent", () => {
    const body = rpc("issue_commercial_quote");
    expect(body).toContain("if v_quote.status = 'Draft' and (");
    expect(body).toContain("valid_until = case when status = 'Draft'");
    expect(body).toContain("else company_snapshot end");
    expect(body).toContain("else payment_snapshot end");
  });

  it("keeps client approval token-gated and idempotently creates one deposit invoice", () => {
    const body = rpc("approve_public_commercial_quote");
    expect(body).toContain("where approval_token_hash = p_token_hash for update");
    expect(body).toContain("if v_quote.status = 'Approved' then");
    expect(body).toContain("billing_type = 'Deposit'");
    expect(migration).toContain("create unique index commercial_deposit_invoice_quote_idx");
  });

  it("books only after a deposit invoice is fully paid", () => {
    const body = rpc("record_commercial_payment");
    expect(body).toContain("v_paid_on is null");
    expect(body).toContain("v_amount::text in ('NaN', 'Infinity', '-Infinity')");
    expect(body).toContain("v_new_paid = v_invoice.total");
    expect(body).toContain("v_invoice.billing_type = 'Deposit'");
    expect(body).toContain("public.create_project_with_plan");
    expect(body).toContain("update public.enquiries set status = 'Booked'");
    expect(body).toContain("update public.commercial_quotes set project_id = v_project_id");
    expect(body).toContain("and v_invoice.quote_id is not null");
  });

  it("grants anonymous access only to the narrow public quote RPCs", () => {
    expect(migration).toContain(
      "grant execute on function public.get_public_commercial_quote(text) to anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.approve_public_commercial_quote(text) to anon, authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.create_commercial_quote(jsonb, jsonb) to anon",
    );
  });
});
