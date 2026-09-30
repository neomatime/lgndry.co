import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260929123000_projects_module.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

describe("projects migration plan replacement", () => {
  it.each([
    ["milestones", "m"],
    ["tasks", "t"],
    ["deliverables", "d"],
  ])("keeps newly inserted %s while deleting offset stale rows", (collection, alias) => {
    expect(migration).toContain(
      `delete from public.project_${collection} ${alias}\n  where ${alias}.project_id = p_project_id\n    and ${alias}.sort_order >= 1000;`,
    );
  });

  it("writes actual newlines into the legacy task and deliverable mirrors", () => {
    expect(migration).toContain("string_agg(t.title, E'\\n' order by t.sort_order)");
    expect(migration).toContain("string_agg(d.title, E'\\n' order by d.sort_order)");
    expect(migration).not.toContain("string_agg(t.title, E'\\\\n' order by t.sort_order)");
    expect(migration).not.toContain("string_agg(d.title, E'\\\\n' order by d.sort_order)");
  });
});
