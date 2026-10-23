import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261023090000_bookings_partnerships_module.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

function rpc(name: string) {
  const match = migration.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
  );
  if (!match) throw new Error(`${name} function is missing`);
  return match[0];
}

describe("bookings and partnerships migration", () => {
  it("preserves the legacy tables and adds structured CRM fields", () => {
    expect(migration).toContain("alter table public.bookings");
    expect(migration).toContain("add column if not exists services text[]");
    expect(migration).toContain("add column if not exists partnership_type text");
    expect(migration).toContain("add column if not exists version integer not null default 1");
    expect(migration).not.toContain("drop table public.bookings");
  });

  it.each(["submit_booking_request", "submit_partnership_request"])(
    "keeps %s narrow, transactional and search-path pinned",
    (name) => {
      const body = rpc(name);
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = ''");
      expect(body).toContain("insert into public.ops_activity_log");
      expect(migration).toContain(
        `grant execute on function public.${name}(jsonb) to anon, authenticated`,
      );
    },
  );

  it.each([
    "update_booking_request",
    "set_booking_request_status",
    "update_partnership_request",
    "set_partnership_request_status",
  ])("admin-gates and version-locks %s", (name) => {
    const body = rpc(name);
    expect(body).toContain("public.is_admin(");
    expect(body).toContain("version is distinct from p_expected_version");
    expect(body).toContain("for update");
    expect(body).toContain("set search_path = ''");
  });

  it("grants no anonymous admin mutation", () => {
    expect(migration).not.toContain(
      "grant execute on function public.update_booking_request(uuid, jsonb, integer) to anon",
    );
    expect(migration).not.toContain(
      "grant execute on function public.set_partnership_request_status(uuid, text, integer, text, text) to anon",
    );
  });
});
