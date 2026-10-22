import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261021120000_inbox_module.sql"),
  "utf8",
).replaceAll("\r\n", "\n");
const fixMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261022143000_fix_inbox_project_client_link.sql"),
  "utf8",
).replaceAll("\r\n", "\n");

function rpc(name: string, source = migration) {
  const match = source.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
  );
  if (!match) throw new Error(`${name} function is missing`);
  return match[0];
}

describe("Inbox migration", () => {
  it("preserves messages while adding account, thread and attachment records", () => {
    expect(migration).toContain("create table public.email_accounts");
    expect(migration).toContain("create table public.email_threads");
    expect(migration).toContain("create table public.email_attachments");
    expect(migration).toContain("for v_email in");
    expect(migration).toContain("where thread_id is null");
    expect(migration).not.toContain("drop table public.emails");
  });

  it("keeps attachment storage private and size-limited", () => {
    expect(migration).toContain("'email-attachments', 'email-attachments', false, 26214400");
    expect(migration).toContain("bucket_id = 'email-attachments'");
    expect(rpc("register_email_attachment")).toContain("select 1 from storage.objects");
  });

  it("removes direct authenticated writes from mailbox tables", () => {
    expect(migration).toContain(
      "revoke insert, update, delete on public.emails from authenticated",
    );
    expect(migration).toContain("grant select on public.emails to authenticated");
    expect(migration).not.toContain(
      "grant insert, update, delete on public.email_threads to authenticated",
    );
  });

  it.each([
    "set_email_thread_state",
    "link_email_thread",
    "save_email_draft",
    "delete_email_draft",
    "register_email_attachment",
  ])("admin-gates and pins the search path for %s", (name) => {
    const body = rpc(name);
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("public.is_admin(");
  });

  it("uses optimistic locking for mutable conversation state", () => {
    expect(rpc("set_email_thread_state")).toContain("v_thread.version <> p_expected_version");
    expect(rpc("link_email_thread")).toContain("v_thread.version <> p_expected_version");
    expect(rpc("save_email_draft")).toContain("v_email.version <> p_expected_version");
    expect(rpc("delete_email_draft")).toContain("v_email.version <> p_expected_version");
    expect(rpc("register_email_attachment")).toContain("v_email.version <> p_expected_version");
  });

  it("keeps linked operational records on the selected client", () => {
    const stateBody = rpc("set_email_thread_state");
    const body = rpc("link_email_thread");
    expect(stateBody).not.toContain("p_links");
    expect(body).toContain("v_client_id uuid := nullif(p_links ->> 'client_id', '')::uuid;");
    expect(body).toContain("Choose the client before linking related records.");
    expect(body).toContain("public.projects where id = v_project_id and client = v_client_id");
    expect(body).toContain("The invoice does not belong to that client.");
    expect(body).toContain("The follow-up does not belong to that client.");
  });

  it("repairs both live RPC definitions without widening execution grants", () => {
    expect(rpc("set_email_thread_state", fixMigration)).not.toContain("p_links");
    expect(rpc("link_email_thread", fixMigration)).toContain(
      "public.projects where id = v_project_id and client = v_client_id",
    );
    expect(fixMigration).toContain(
      "revoke all on function public.link_email_thread(uuid, jsonb, integer)",
    );
    expect(fixMigration).toContain(
      "grant execute on function public.link_email_thread(uuid, jsonb, integer) to authenticated",
    );
  });

  it("grants mailbox RPCs only to authenticated users", () => {
    expect(migration).toContain(
      "grant execute on function public.set_email_thread_state(uuid, text, integer) to authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.set_email_thread_state(uuid, text, integer) to anon",
    );
  });
});
