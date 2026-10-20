import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261020100000_ops_settings.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

function updateFunction() {
  const match = migration.match(
    /create or replace function public\.update_ops_settings\([\s\S]*?\$\$;/,
  );
  if (!match) throw new Error("update_ops_settings function is missing");
  return match[0];
}

describe("ops settings migration", () => {
  it("creates one constrained settings table with all approved groups", () => {
    expect(migration).toContain("create table public.ops_settings");
    expect(migration).toContain("constraint ops_settings_singleton_check");
    expect(migration).toContain("00000000-0000-4000-8000-000000000001");
    expect(migration).toContain("default_quote_terms text not null");
    expect(migration).toContain("default_retainer_percentage numeric(5, 2)");
    expect(migration).toContain("payment_reference_instructions text not null");
    expect(migration).toContain("sender_email text not null");
    expect(migration).toContain("version integer not null default 1");
  });

  it("seeds only approved values and leaves unknown commercial fields blank", () => {
    expect(migration).toContain("'LGNDRY.Co'");
    expect(migration).toContain("'info@lgndry-co.co.za'");
    expect(migration).toContain("'https://www.lgndry-co.co.za'");
    expect(migration).toContain("'Africa/Johannesburg'");
    expect(migration).toContain("'ZAR'");
    expect(migration).toMatch(/default_quote_terms text not null default ''/);
    expect(migration).toMatch(/bank_name text not null default ''/);
  });

  it("allows only admin reads and no direct application writes", () => {
    expect(migration).toContain("alter table public.ops_settings enable row level security");
    expect(migration).toContain(
      "revoke all on table public.ops_settings from public, anon, authenticated, service_role",
    );
    expect(migration).toContain("grant select on table public.ops_settings to authenticated");
    expect(migration).toContain("create policy admin_select on public.ops_settings");
    expect(migration).toContain("using (public.is_admin((select auth.uid())))");
    expect(migration).not.toContain("grant insert on table public.ops_settings");
    expect(migration).not.toContain("grant update on table public.ops_settings");
    expect(migration).not.toContain("grant delete on table public.ops_settings");
  });

  it("exposes only the narrow authenticated update RPC", () => {
    expect(migration).toContain(
      "revoke all on function public.update_ops_settings(jsonb, integer)",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;\ngrant execute on function public.update_ops_settings(jsonb, integer)\n  to authenticated;",
    );
  });

  it("independently checks admin access, locks the singleton and treats null versions as stale", () => {
    const body = updateFunction();
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("if not public.is_admin((select auth.uid())) then");
    expect(body).toContain("raise exception using errcode = '42501'");
    expect(body).toContain("for update");
    expect(body).toContain("v_existing.version is distinct from p_expected_version");
    expect(body).toContain("'status', 'conflict'");
  });

  it("validates fixed locale and commercial ranges in SQL", () => {
    const body = updateFunction();
    expect(body).toContain("v_time_zone <> 'Africa/Johannesburg'");
    expect(body).toContain("v_currency <> 'ZAR'");
    expect(body).toContain("v_default_retainer_percentage is null");
    expect(body).toContain("v_default_retainer_percentage <= 0");
    expect(body).toContain("v_default_retainer_percentage > 100");
    expect(body).toContain("v_default_quote_validity_days is null");
    expect(body).toContain("v_default_quote_validity_days not between 1 and 365");
    expect(body).toContain("v_default_deposit_due_days is null");
    expect(body).toContain("v_default_deposit_due_days not between 1 and 365");
  });

  it("increments the version and writes a value-free activity message", () => {
    const body = updateFunction();
    expect(body).toContain("version = version + 1");
    expect(body).toContain("values ('Workspace settings updated', 'settings', v_id, 'updated')");
    expect(body).not.toMatch(/ops_activity_log[\s\S]*v_account_number/);
    expect(body).not.toMatch(/ops_activity_log[\s\S]*v_default_quote_terms/);
  });
});
