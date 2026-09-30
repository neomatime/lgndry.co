import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260930113000_enquiry_write_flow.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

describe("enquiry write-flow migration", () => {
  it.each(["update_enquiry_record(uuid, jsonb)", "set_enquiry_status(uuid, text)"])(
    "admin-gates and restricts %s",
    (signature) => {
      expect(migration).toContain("if not public.is_admin((select auth.uid())) then");
      expect(migration).toContain(`revoke all on function public.${signature}`);
      expect(migration).toContain(`grant execute on function public.${signature}`);
    },
  );

  it("records edits and status changes against the enquiry", () => {
    expect(migration).toContain("'enquiries', p_enquiry_id, 'updated'");
    expect(migration).toContain("'enquiries', p_enquiry_id, 'status_updated'");
  });

  it("reserves project-owned statuses for the project workflow", () => {
    expect(migration).toContain(
      "p_status not in ('New', 'Reviewing', 'Quoted', 'Follow-up', 'Closed')",
    );
    expect(migration).toContain("where enquiry_id = p_enquiry_id");
  });
});
