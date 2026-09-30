import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260930141545_follow_ups_module.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

const RPC_FUNCTIONS = [
  "create_follow_up",
  "update_follow_up",
  "set_follow_up_checklist_item",
  "reschedule_follow_up",
  "complete_follow_up",
  "cancel_follow_up",
  "reopen_follow_up",
] as const;

/**
 * Extracts one `create or replace function public.<name>(...) ... $$;` block
 * by name, scoped to that single function's signature and body. Used so
 * per-function assertions (e.g. "does this function independently check
 * is_admin?") actually fail when the check is missing from just one
 * function, unlike a file-wide `toContain` which passes as long as the text
 * appears anywhere in the migration.
 */
function extractFunctionBody(name: string): string {
  const pattern = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`);
  const match = migration.match(pattern);
  if (!match) throw new Error(`could not find function public.${name} in the migration`);
  return match[0];
}

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
  ])("revokes from and re-grants only to authenticated for %s", (signature) => {
    expect(migration).toContain(`revoke all on function public.${signature}`);
    expect(migration).toContain(`grant execute on function public.${signature}`);
  });

  describe("each RPC independently verifies admin access", () => {
    it.each(RPC_FUNCTIONS)("checks is_admin inside %s, not just somewhere in the file", (name) => {
      const body = extractFunctionBody(name);
      // create_follow_up assigns auth.uid() to a variable first and checks
      // that; every other function inlines `(select auth.uid())`. Either
      // phrasing is accepted, but the check must be present in THIS
      // function's own body - deleting it from one function must fail only
      // that function's case, not be masked by the check existing elsewhere.
      expect(body).toMatch(/if not public\.is_admin\(/);
      expect(body).toMatch(/raise exception using errcode = '42501'/);
    });
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

  describe("checklist reordering does not violate the sort_order uniqueness constraint", () => {
    it("declares the (follow_up_id, sort_order) constraint deferrable so a swap can commit", () => {
      // Without this, update_follow_up's per-row UPDATE loop fails on the
      // very first statement whenever two items swap positions (or a new
      // item takes a position an existing item still holds): Postgres
      // checks a non-deferrable unique constraint after every statement,
      // not at the end of the transaction.
      expect(migration).toContain(
        "unique (follow_up_id, sort_order) deferrable initially deferred",
      );
    });

    /**
     * A minimal, deterministic model of Postgres's unique-constraint
     * checking for `follow_up_checklist_items (follow_up_id, sort_order)`,
     * applied to the exact write pattern `update_follow_up` uses for
     * existing checklist items: one `UPDATE ... SET sort_order = ...`
     * per row, in the loop's iteration order. This proves the fix
     * mechanism (deferring the constraint) is what makes a same-follow-up
     * reorder possible, and that reverting it reproduces the original bug.
     */
    function simulateChecklistReorder(
      rows: Array<{ id: string; sortOrder: number }>,
      updates: Array<{ id: string; sortOrder: number }>,
      { deferred }: { deferred: boolean },
    ) {
      const state = new Map(rows.map((row) => [row.id, row.sortOrder]));
      const assertNoDuplicates = () => {
        const seen = new Set<number>();
        for (const value of state.values()) {
          if (seen.has(value)) {
            throw new Error(
              `duplicate key value violates unique constraint "follow_up_checklist_items_follow_up_id_sort_order_key"`,
            );
          }
          seen.add(value);
        }
      };
      for (const update of updates) {
        state.set(update.id, update.sortOrder);
        if (!deferred) assertNoDuplicates();
      }
      assertNoDuplicates(); // deferred constraints are always checked by commit
    }

    // update_follow_up writes items in their NEW order: moving item-a to
    // item-b's old slot (0) happens before item-b is moved out of it.
    const rows = [
      { id: "item-a", sortOrder: 0 },
      { id: "item-b", sortOrder: 1 },
    ];
    const swap = [
      { id: "item-a", sortOrder: 1 },
      { id: "item-b", sortOrder: 0 },
    ];

    it("would have raised a duplicate-key error mid-swap before the fix (immediate constraint)", () => {
      expect(() => simulateChecklistReorder(rows, swap, { deferred: false })).toThrow(
        /duplicate key/,
      );
    });

    it("commits successfully once the constraint is deferred to end of transaction", () => {
      expect(() => simulateChecklistReorder(rows, swap, { deferred: true })).not.toThrow();
    });
  });

  describe("update_follow_up validates before writing, not after", () => {
    it("checks every checklist item id exists up front, before the follow-up row is written", () => {
      const body = extractFunctionBody("update_follow_up");
      const validationIndex = body.indexOf("ci.follow_up_id = p_follow_up_id");
      const firstWriteIndex = body.indexOf("update public.follow_ups set");
      expect(validationIndex).toBeGreaterThan(-1);
      expect(firstWriteIndex).toBeGreaterThan(-1);
      // If this ever regresses to AFTER the first write (as it did
      // originally, mid checklist-update-loop), a bad checklist item id
      // would leave the follow-up row's edits committed with no rollback.
      expect(validationIndex).toBeLessThan(firstWriteIndex);
    });

    it("raises (rather than returns) if a checklist item still goes missing after that check", () => {
      const body = extractFunctionBody("update_follow_up");
      expect(body).toContain("raise exception using errcode = 'P0001'");
    });
  });

  describe("archived linked records only block a NEW or CHANGED relation on edit", () => {
    it("defines an edit-aware relationship check that exempts unchanged relation ids", () => {
      expect(migration).toContain("public.follow_up_relationships_valid_for_edit");
      expect(migration).toContain("c.archived = false or p_client_id = p_existing_client_id");
      expect(migration).toContain("cc.archived = false or p_contact_id = p_existing_contact_id");
      expect(migration).toContain("e.archived = false or p_enquiry_id = p_existing_enquiry_id");
      expect(migration).toContain("p.archived = false or p_project_id = p_existing_project_id");
    });

    it("update_follow_up calls the edit-aware check, not the create-only strict one", () => {
      const body = extractFunctionBody("update_follow_up");
      expect(body).toContain("public.follow_up_relationships_valid_for_edit(");
      expect(body).not.toContain("not public.follow_up_relationships_valid(");
    });

    it("create_follow_up still uses the strict, always-archived-blocking check", () => {
      const body = extractFunctionBody("create_follow_up");
      expect(body).toContain("not public.follow_up_relationships_valid(");
      expect(body).not.toContain("follow_up_relationships_valid_for_edit");
    });

    it("surfaces a clear, actionable message instead of the raw payload-shape text", () => {
      const clearMessage =
        "The selected contact, enquiry, or project doesn''t belong to this client.";
      expect(extractFunctionBody("create_follow_up")).toContain(clearMessage);
      expect(extractFunctionBody("update_follow_up")).toContain(clearMessage);
    });
  });

  describe("reference-number sequence privileges", () => {
    it("revokes anon/authenticated default privileges on the identity sequence", () => {
      // Supabase grants anon/authenticated USAGE+SELECT+UPDATE on every new
      // sequence by default; without an explicit revoke, both roles could
      // read (and advance) the reference-number sequence directly.
      expect(migration).toContain("revoke all on sequence public.follow_ups_reference_number_seq");
      expect(migration).toContain("from public, anon, authenticated");
      expect(migration).toContain(
        "grant usage, select on sequence public.follow_ups_reference_number_seq to service_role",
      );
    });
  });

  describe("lock ordering between set_follow_up_checklist_item and update_follow_up", () => {
    it("locks the follow-up row before the checklist item in set_follow_up_checklist_item", () => {
      const body = extractFunctionBody("set_follow_up_checklist_item");
      const followUpLockIndex = body.indexOf(
        "from public.follow_ups where id = v_follow_up_id for update",
      );
      const itemLockIndex = body.indexOf(
        "from public.follow_up_checklist_items where id = p_item_id for update",
      );
      expect(followUpLockIndex).toBeGreaterThan(-1);
      expect(itemLockIndex).toBeGreaterThan(-1);
      // update_follow_up locks the follow-up row first (it IS the row being
      // edited), then touches checklist items. If this function took the
      // opposite order, two concurrent calls (one toggling a checklist item,
      // one editing the follow-up) could deadlock by acquiring the same two
      // locks in reverse order.
      expect(followUpLockIndex).toBeLessThan(itemLockIndex);
    });

    it("update_follow_up locks the follow-up row first, before any checklist item write", () => {
      const body = extractFunctionBody("update_follow_up");
      const followUpLockIndex = body.indexOf(
        "from public.follow_ups\n  where id = p_follow_up_id for update",
      );
      const checklistWriteIndex = body.indexOf("delete from public.follow_up_checklist_items");
      expect(followUpLockIndex).toBeGreaterThan(-1);
      expect(checklistWriteIndex).toBeGreaterThan(-1);
      expect(followUpLockIndex).toBeLessThan(checklistWriteIndex);
    });
  });

  describe("set_follow_up_checklist_item guards the second, locked read of the item", () => {
    it("checks the locked re-read actually found the item, after the follow-up lock reorder", () => {
      const body = extractFunctionBody("set_follow_up_checklist_item");
      const lockedItemReadIndex = body.indexOf(
        "from public.follow_up_checklist_items where id = p_item_id for update",
      );
      const notFoundGuardIndex = body.indexOf(
        "if not found then\n    return jsonb_build_object('status', 'not-found');\n  end if;",
      );
      const versionCheckIndex = body.indexOf("if v_item.version <> p_version then");
      // Between the unlocked lookup (used to get the lock order right) and
      // this locked re-read, another transaction could have deleted the
      // item while this call waited on the follow-up lock. Without a
      // not-found guard here, v_item would come back all-NULL: the version
      // comparison would silently evaluate to NULL (never matching, never
      // catching anything) and the later UPDATEs would target a NULL id and
      // affect zero rows while still returning 'ok'.
      expect(lockedItemReadIndex).toBeGreaterThan(-1);
      expect(notFoundGuardIndex).toBeGreaterThan(-1);
      expect(versionCheckIndex).toBeGreaterThan(-1);
      expect(lockedItemReadIndex).toBeLessThan(notFoundGuardIndex);
      expect(notFoundGuardIndex).toBeLessThan(versionCheckIndex);
    });

    it("uses the id captured before the lock, not the (possibly stale) locked row, for later writes", () => {
      const body = extractFunctionBody("set_follow_up_checklist_item");
      // v_item could be all-NULL past the not-found guard in a differently
      // ordered rewrite; v_follow_up_id was captured from the initial
      // unlocked read and is never reassigned, so relying on it for the
      // follow-up version bump, the activity log, and the returned
      // follow_up_id is the more robust choice.
      expect(body).not.toContain("v_item.follow_up_id");
      expect(body.match(/= v_follow_up_id/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(body).toContain("'follow_ups', v_follow_up_id, 'checklist_updated'");
      expect(body).toContain("'status', 'ok', 'follow_up_id', v_follow_up_id");
    });
  });
});
