import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260930141545_follow_ups_module.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

describe("follow-ups migration", () => {
  it.each(["follow_up_series", "follow_ups", "follow_up_checklist_items"])(
    "creates and protects %s",
    (table) => {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${table}`);
    },
  );

  it.each([
    "create_follow_up(jsonb, jsonb, jsonb)",
    "update_follow_up(uuid, jsonb, jsonb, jsonb, text, integer)",
    "set_follow_up_checklist_item(uuid, boolean, integer)",
    "reschedule_follow_up(uuid, date, time, text, jsonb, integer)",
    "complete_follow_up(uuid, text, date, integer)",
    "cancel_follow_up(uuid, text, text, date, integer)",
    "reopen_follow_up(uuid, integer)",
  ])("admin-gates and restricts %s", (signature) => {
    expect(migration).toContain("if not public.is_admin((select auth.uid())) then");
    expect(migration).toContain(`revoke all on function public.${signature}`);
    expect(migration).toContain(`grant execute on function public.${signature}`);
  });

  it("validates relationships and preserves one related record", () => {
    expect(migration).toContain("public.follow_up_relationships_valid");
    expect(migration).toContain("num_nonnulls(enquiry_id, project_id) <= 1");
    expect(migration).toContain("cc.client_id = p_client_id");
    expect(migration).toContain("e.client_id = p_client_id");
    expect(migration).toContain("p.client = p_client_id");
  });

  it("locks mutations and makes recurring advancement idempotent", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("unique (series_id, occurrence_number)");
    expect(migration).toContain("successor_id");
    expect(migration).toContain("Follow-up changed elsewhere.");
  });

  it("attributes every mutation to the follow-up collection", () => {
    expect(migration).toContain("'follow_ups', v_follow_up_id, 'created'");
    expect(migration).toContain("'follow_ups', p_follow_up_id, 'completed'");
    expect(migration).toContain("'follow_ups', p_follow_up_id, 'cancelled'");
    expect(migration).toContain("'follow_ups', p_follow_up_id, 'reopened'");
  });
});
