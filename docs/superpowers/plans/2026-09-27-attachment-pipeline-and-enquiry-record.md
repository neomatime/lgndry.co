# Attachment Pipeline and Enquiry Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the studio a working, secure pipeline from a public "Start a
Project" enquiry form (with file attachments) to a database record an admin
can see and open — the highest-priority gap named in the Command Center
refinement scope.

**Architecture:** Two new Postgres tables (`enquiries`, `enquiry_attachments`)
and a private Storage bucket, written exclusively through one
`SECURITY DEFINER` function (`submit_enquiry`) called by a Next.js Server
Action — no anon table policies, no service-role key. Files are validated
twice (browser, then server-side size/extension/magic-byte check) before
upload. A bare admin page under the existing `/ops` auth guard proves an
admin can list enquiries and open their attachments via short-lived signed
URLs.

**Tech Stack:** Next.js 16.3.6 (App Router, Server Actions), React 19.3,
TypeScript (strict), zod 4, `@supabase/supabase-js` / `@supabase/ssr`,
Vitest 5 + Testing Library, pnpm.

## Global Constraints

- Allowed attachment types: PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX — no others.
- Limits: 15 MB per file (`15 * 1024 * 1024` bytes), 5 files per submission.
- No service-role key anywhere in this feature. Every write goes through
  Postgres row-level security or the one `SECURITY DEFINER` function.
- Do not modify the existing Contact page, Booking dialog, Partnership
  dialog, or the `clients` / `bookings` / `partnerships` tables' existing
  policies. They keep working exactly as today.
- Do not add a nav link or CTA to `/start-a-project`, and do not touch
  site navigation. That is a later sub-project.
- The `/ops/enquiries` admin page must stay bare: a table and download
  links, no search/filter/tabs/styling pass. The styled version is a later
  sub-project (`docs/design-references/enquiries.png` / `view-enquiry.png`).
- Supabase project is `tscaluhtfrvwlwjybfsg` ("lgndry-co-ops"). Every
  migration must be verified with a rolled-back transaction (`begin; ...;
  rollback;`) before being considered done — this project's established
  convention.
- Governing design doc:
  `docs/superpowers/specs/2026-09-27-attachment-pipeline-and-enquiry-record-design.md`.
  Re-read it if anything here seems to conflict with it — this plan should
  match it exactly.
- End every commit with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

---

## Task 1: Database migration — tables, function, bucket

**Files:**
- Create: `supabase/migrations/20260927_enquiries_and_attachments.sql`

**Interfaces:**
- Produces: tables `public.enquiries`, `public.enquiry_attachments`; function
  `public.submit_enquiry(full_name text, company text, email text, phone
  text, project_type text, location text, timeline text, description text,
  budget text, client_notes text, attachments jsonb default '[]'::jsonb)
  returns uuid`; Storage bucket `enquiry-attachments`. All later tasks call
  this function and read these tables.

- [ ] **Step 1: Write the migration file**

```sql
-- Attachment pipeline and enquiry record.
--
-- New public "Start a Project" form (a later task) writes here through
-- submit_enquiry() only — there are no direct anon INSERT policies on
-- clients/enquiries/enquiry_attachments, because matching an enquiry to an
-- existing client requires reading `clients` by email first, and `anon`
-- must never be able to read that table directly (it would expose every
-- client's name, email and phone). The function does that lookup
-- internally and returns only the new enquiry id.
--
-- The existing Contact page, Booking dialog and Partnership dialog are
-- untouched: they keep writing into clients/bookings/partnerships exactly
-- as before. See docs/superpowers/specs/2026-09-27-attachment-pipeline-and-
-- enquiry-record-design.md for the full design.

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id),
  full_name text not null,
  company text,
  email text not null,
  phone text not null,
  project_type text not null,
  location text not null,
  timeline text not null,
  description text not null,
  budget text,
  status text not null default 'New'
    check (
      status in (
        'New', 'Reviewing', 'Quoted', 'Follow-up', 'Booked',
        'In Production', 'Completed', 'Closed'
      )
    ),
  source text not null default 'Website',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

create index enquiries_status_idx on public.enquiries (status);
create index enquiries_created_at_idx on public.enquiries (created_at desc);

alter table public.enquiries enable row level security;

create policy admin_full_access on public.enquiries
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create table public.enquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create index enquiry_attachments_enquiry_id_idx
  on public.enquiry_attachments (enquiry_id);

alter table public.enquiry_attachments enable row level security;

create policy admin_full_access on public.enquiry_attachments
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- Writes the client (matched by email, or newly created), the enquiry, and
-- its attachment rows in one transaction. status/archived are always
-- forced here, never taken from a caller-supplied value.
create or replace function public.submit_enquiry(
  full_name text,
  company text,
  email text,
  phone text,
  project_type text,
  location text,
  timeline text,
  description text,
  budget text,
  client_notes text,
  attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_client_id uuid;
  new_enquiry_id uuid;
  attachment jsonb;
begin
  if project_type not in (
    'Documentary', 'Event', 'Film', 'Visual Production', 'Other'
  ) then
    raise exception 'invalid project_type: %', project_type;
  end if;
  if coalesce(trim(full_name), '') = '' or coalesce(trim(email), '') = '' then
    raise exception 'full_name and email are required';
  end if;

  select c.id into matched_client_id
  from public.clients c
  where c.archived = false
    and lower(c.email) = lower(submit_enquiry.email)
  order by c.created_at asc
  limit 1;

  if matched_client_id is null then
    insert into public.clients (name, type, contact, email, phone, status, notes)
    values (
      full_name,
      case when coalesce(trim(company), '') <> '' then 'Company' else 'Individual' end,
      full_name,
      email,
      phone,
      'Lead',
      client_notes
    )
    returning id into matched_client_id;
  end if;

  insert into public.enquiries (
    client_id, full_name, company, email, phone, project_type,
    location, timeline, description, budget, status, source, archived
  )
  values (
    matched_client_id, full_name, nullif(trim(company), ''), email, phone,
    project_type, location, timeline, description, nullif(trim(budget), ''),
    'New', 'Website', false
  )
  returning id into new_enquiry_id;

  for attachment in select * from jsonb_array_elements(coalesce(attachments, '[]'::jsonb))
  loop
    insert into public.enquiry_attachments (
      enquiry_id, storage_path, file_name, mime_type, size_bytes
    )
    values (
      new_enquiry_id,
      attachment ->> 'storage_path',
      attachment ->> 'file_name',
      attachment ->> 'mime_type',
      (attachment ->> 'size_bytes')::integer
    );
  end loop;

  return new_enquiry_id;
end;
$$;

revoke all on function public.submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'enquiry-attachments',
  'enquiry-attachments',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

create policy enquiry_attachments_anon_upload on storage.objects
  for insert to anon
  with check (bucket_id = 'enquiry-attachments');

create policy enquiry_attachments_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'enquiry-attachments'
    and public.is_admin((select auth.uid()))
  );
```

- [ ] **Step 2: Apply the migration to the live project**

Apply `supabase/migrations/20260927_enquiries_and_attachments.sql` to
project `tscaluhtfrvwlwjybfsg` (e.g. via the `apply_migration` MCP tool, or
`supabase db push` / the SQL editor if working outside this environment).

- [ ] **Step 3: Verify inside a rolled-back transaction**

Run this against the live database (e.g. via the `execute_sql` MCP tool, or
`psql`/the SQL editor) and confirm it raises `'ALL CHECKS PASSED'` — an
error with any other message means something is wrong and must be fixed
before continuing:

```sql
begin;
do $$
declare
  admin_id uuid;
  new_id uuid;
  n int;
  before_clients int;
begin
  select user_id into admin_id from public.admin_users limit 1;
  select count(*) into before_clients from public.clients;

  set local role anon;

  -- anon cannot read or directly write the new tables
  begin
    perform 1 from public.enquiries limit 1;
    raise exception 'FAIL anon can read enquiries';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.enquiries (full_name, email, phone, project_type, location, timeline, description)
    values ('x', 'x@example.com', 'x', 'Other', 'x', 'x', 'x');
    raise exception 'FAIL anon inserted an enquiry directly';
  exception when insufficient_privilege then null; end;

  -- anon can call submit_enquiry, which creates a new client (no match yet)
  select public.submit_enquiry(
    'Test Visitor', 'Test Co', 'test-visitor@example.com', '0700000000',
    'Documentary', 'Cape Town', 'Next month', 'A test enquiry.', 'R10,000',
    'Company: Test Co',
    '[{"storage_path":"dryrun/0-brief.pdf","file_name":"brief.pdf","mime_type":"application/pdf","size_bytes":1024}]'::jsonb
  ) into new_id;
  if new_id is null then raise exception 'FAIL submit_enquiry returned null'; end if;

  -- a second submission with the same email reuses the same client
  perform public.submit_enquiry(
    'Test Visitor', 'Test Co', 'test-visitor@example.com', '0700000000',
    'Film', 'Cape Town', 'Flexible', 'A second enquiry.', null, 'Company: Test Co'
  );
  select count(*) into n from public.clients where email = 'test-visitor@example.com';
  if n <> 1 then raise exception 'FAIL expected exactly 1 client, got %', n; end if;

  -- an invalid project_type is rejected
  begin
    perform public.submit_enquiry(
      'x', null, 'x2@example.com', 'x', 'Not A Real Type', 'x', 'x', 'x', null, null
    );
    raise exception 'FAIL accepted an invalid project_type';
  exception when others then null; end;

  -- anon can upload into the bucket but cannot read/list it back
  insert into storage.objects (bucket_id, name) values ('enquiry-attachments', 'dryrun/anon-check.txt');
  begin
    perform 1 from storage.objects where bucket_id = 'enquiry-attachments' and name = 'dryrun/anon-check.txt';
    raise exception 'FAIL anon can read the attachments bucket';
  exception when insufficient_privilege then null; end;

  reset role;

  -- the admin sees everything
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  select count(*) into n from public.enquiries; if n < 2 then raise exception 'FAIL admin sees % enquiries', n; end if;
  select count(*) into n from public.enquiry_attachments; if n < 1 then raise exception 'FAIL admin sees no attachments'; end if;
  select count(*) into n from storage.objects where bucket_id = 'enquiry-attachments'; if n < 1 then raise exception 'FAIL admin cannot see bucket objects'; end if;
  reset role;

  raise exception 'ALL CHECKS PASSED (rolled back): clients before=%, submit_enquiry ok, dedup ok, bad project_type rejected, anon bucket write-only, admin sees all', before_clients;
end $$;
rollback;
```

- [ ] **Step 4: Confirm nothing was left behind**

```sql
select
  (select count(*) from public.enquiries) as enquiries,
  (select count(*) from public.clients where email = 'test-visitor@example.com') as test_clients,
  (select count(*) from storage.objects where bucket_id = 'enquiry-attachments') as bucket_objects;
```

Expected: all three are `0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260927_enquiries_and_attachments.sql
git commit -m "db: enquiries, enquiry_attachments and submit_enquiry()

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: File validation

**Files:**
- Create: `src/features/start-a-project/file-validation.ts`
- Test: `src/features/start-a-project/file-validation.test.ts`

**Interfaces:**
- Produces: `MAX_FILE_BYTES: number`, `MAX_FILES: number`, `FileCheck = {
  ok: true } | { ok: false; error: string }`, `extensionOf(fileName: string):
  string`, `checkFileMeta(fileName: string, size: number): FileCheck`,
  `checkFileContent(fileName: string, bytes: Uint8Array): FileCheck`,
  `checkFileCount(count: number): FileCheck`, `sanitizeFileName(fileName:
  string): string`. Task 4 (Server Action) and Task 5 (form) both import
  these directly by name.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import {
  MAX_FILES,
  checkFileContent,
  checkFileCount,
  checkFileMeta,
  extensionOf,
  sanitizeFileName,
} from "@/features/start-a-project/file-validation";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy .doc / .xls
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]); // .docx / .xlsx
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]); // "MZ" (Windows executable)

describe("extensionOf", () => {
  it("reads the lower-cased extension", () => {
    expect(extensionOf("Brief.PDF")).toBe("pdf");
    expect(extensionOf("photo.jpeg")).toBe("jpeg");
  });

  it("is empty for a file with no extension", () => {
    expect(extensionOf("README")).toBe("");
  });
});

describe("checkFileMeta", () => {
  it("accepts an allowed extension within the size limit", () => {
    expect(checkFileMeta("brief.pdf", 1024)).toEqual({ ok: true });
  });

  it("rejects a disallowed extension", () => {
    const result = checkFileMeta("script.exe", 1024);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("script.exe") });
  });

  it("rejects a file over 15 MB", () => {
    const result = checkFileMeta("brief.pdf", 15 * 1024 * 1024 + 1);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("15 MB") });
  });

  it("rejects an empty file", () => {
    expect(checkFileMeta("brief.pdf", 0).ok).toBe(false);
  });

  it("accepts every allowed extension", () => {
    for (const extension of ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"]) {
      expect(checkFileMeta(`file.${extension}`, 1024)).toEqual({ ok: true });
    }
  });
});

describe("checkFileContent", () => {
  it("accepts a file whose bytes match its extension", () => {
    expect(checkFileContent("brief.pdf", PDF)).toEqual({ ok: true });
    expect(checkFileContent("photo.jpg", JPEG)).toEqual({ ok: true });
    expect(checkFileContent("photo.png", PNG)).toEqual({ ok: true });
    expect(checkFileContent("old.doc", OLE)).toEqual({ ok: true });
    expect(checkFileContent("old.xls", OLE)).toEqual({ ok: true });
    expect(checkFileContent("new.docx", ZIP)).toEqual({ ok: true });
    expect(checkFileContent("new.xlsx", ZIP)).toEqual({ ok: true });
  });

  it("rejects a disguised executable claiming to be a PDF", () => {
    const result = checkFileContent("invoice.pdf", EXE);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("invoice.pdf") });
  });

  it("rejects a JPEG renamed to .png", () => {
    expect(checkFileContent("photo.png", JPEG).ok).toBe(false);
  });

  it("rejects an unsupported extension outright", () => {
    expect(checkFileContent("script.exe", EXE).ok).toBe(false);
  });
});

describe("checkFileCount", () => {
  it(`allows up to ${MAX_FILES} files`, () => {
    expect(checkFileCount(MAX_FILES)).toEqual({ ok: true });
  });

  it(`rejects more than ${MAX_FILES} files`, () => {
    const result = checkFileCount(MAX_FILES + 1);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining(String(MAX_FILES)) });
  });
});

describe("sanitizeFileName", () => {
  it("strips path separators and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("......etcpasswd");
    expect(sanitizeFileName("My Brief (final)!!.pdf")).toBe("My Brief (final).pdf");
  });

  it("never returns an empty string", () => {
    expect(sanitizeFileName("???")).toBe("file");
  });

  it("keeps a long name to a sane length", () => {
    expect(sanitizeFileName("a".repeat(300) + ".pdf").length).toBeLessThanOrEqual(150);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/start-a-project/file-validation.test.ts`
Expected: FAIL — `Cannot find module '@/features/start-a-project/file-validation'`

- [ ] **Step 3: Write the implementation**

```typescript
// Validates a "Start a Project" file attachment. Every check here is
// authoritative — the form re-runs the cheap checks (extension, size) in
// the browser for instant feedback, but only this module's result is
// trusted before a file is uploaded or recorded.

export type FileFamily = "pdf" | "jpeg" | "png" | "ole" | "zip-office";

const SIGNATURES: { family: FileFamily; bytes: number[] }[] = [
  { family: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { family: "jpeg", bytes: [0xff, 0xd8, 0xff] },
  { family: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { family: "ole", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // legacy .doc / .xls
  { family: "zip-office", bytes: [0x50, 0x4b, 0x03, 0x04] }, // .docx / .xlsx (Zip container)
];

/**
 * Legacy .doc and .xls share one container signature (OLE Compound File),
 * and modern .docx and .xlsx share another (Zip) — this can confirm the
 * family, not the exact legacy-vs-modern pairing within it. Both members of
 * each pair are equally legitimate business documents; the real threat this
 * guards against (an executable or script disguised as a document) is
 * caught either way, since none of it matches any of these five signatures.
 */
export function detectFamily(bytes: Uint8Array): FileFamily | null {
  for (const signature of SIGNATURES) {
    if (bytes.length < signature.bytes.length) continue;
    if (signature.bytes.every((byte, index) => bytes[index] === byte)) return signature.family;
  }
  return null;
}

const EXTENSION_FAMILY: Record<string, FileFamily> = {
  pdf: "pdf",
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  doc: "ole",
  xls: "ole",
  docx: "zip-office",
  xlsx: "zip-office",
};

export const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_FAMILY);
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES = 5;

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export type FileCheck = { ok: true } | { ok: false; error: string };

/** Cheap checks that don't need the file's bytes: extension and size. */
export function checkFileMeta(fileName: string, size: number): FileCheck {
  const extension = extensionOf(fileName);
  if (!EXTENSION_FAMILY[extension]) {
    return {
      ok: false,
      error: `${fileName}: only PDF, JPG, PNG, DOC, DOCX, XLS and XLSX files are accepted.`,
    };
  }
  if (size <= 0) return { ok: false, error: `${fileName} is empty.` };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `${fileName} is over the 15 MB limit.` };
  return { ok: true };
}

/** Confirms a file's real content matches what its extension claims. */
export function checkFileContent(fileName: string, bytes: Uint8Array): FileCheck {
  const extension = extensionOf(fileName);
  const expected = EXTENSION_FAMILY[extension];
  if (!expected) return { ok: false, error: `${fileName}: unsupported file type.` };
  if (detectFamily(bytes) !== expected) {
    return {
      ok: false,
      error: `${fileName} does not look like a valid ${extension.toUpperCase()} file.`,
    };
  }
  return { ok: true };
}

export function checkFileCount(count: number): FileCheck {
  if (count > MAX_FILES) return { ok: false, error: `Please attach at most ${MAX_FILES} files.` };
  return { ok: true };
}

/** Strips path separators and anything outside a safe filename charset. */
export function sanitizeFileName(fileName: string): string {
  const safe = fileName.replace(/[\\/]/g, "").replace(/[^\w.\- ()]/g, "");
  return safe.slice(-150) || "file";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/start-a-project/file-validation.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/start-a-project/file-validation.ts src/features/start-a-project/file-validation.test.ts
git commit -m "feat: file validation for Start a Project attachments

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Enquiry schema and record shaping

**Files:**
- Create: `src/features/start-a-project/schemas.ts`
- Create: `src/features/start-a-project/records.ts`
- Test: `src/features/start-a-project/records.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PROJECT_TYPES: readonly ["Documentary", "Event", "Film",
  "Visual Production", "Other"]`, `projectEnquirySchema: ZodObject`,
  `ProjectEnquiryInput` (zod-inferred type with fields `full_name, company,
  email, phone, project_type, location, timeline, description, budget,
  hp_website`), `UploadedFile = { storage_path: string; file_name: string;
  mime_type: string; size_bytes: number }`, `newClientNotes(company:
  string): string`, `enquiryActivityMessage(fullName: string): string`,
  `submitEnquiryArgs(input: ProjectEnquiryInput, uploaded: UploadedFile[]):
  object` (matching `submit_enquiry`'s named parameters from Task 1). Task 4
  (Server Action) and Task 5 (form) both import these.

- [ ] **Step 1: Write `schemas.ts`**

```typescript
import { z } from "zod";

// Server-side validation for the Start a Project form. The browser already
// enforces required fields; this is the check that can't be bypassed.
// Limits are deliberately generous — they exist to stop abuse, not to
// police content.

const optional = (max: number) => z.string().trim().max(max).default("");
const required = (max: number) => z.string().trim().min(1).max(max);
const email = z.string().trim().max(254).pipe(z.email());

// Hidden field real visitors never see or fill; bots often do.
const honeypot = z.string().max(500).optional();

export const PROJECT_TYPES = [
  "Documentary",
  "Event",
  "Film",
  "Visual Production",
  "Other",
] as const;

export const projectEnquirySchema = z.object({
  full_name: required(120),
  company: optional(160),
  email,
  phone: required(40),
  project_type: z.enum(PROJECT_TYPES),
  location: required(200),
  timeline: required(200),
  description: required(2000),
  budget: optional(200),
  hp_website: honeypot,
});

export type ProjectEnquiryInput = z.infer<typeof projectEnquirySchema>;
```

- [ ] **Step 2: Write the failing tests for `records.ts`**

```typescript
import { describe, expect, it } from "vitest";
import type { ProjectEnquiryInput } from "@/features/start-a-project/schemas";
import {
  enquiryActivityMessage,
  newClientNotes,
  submitEnquiryArgs,
  type UploadedFile,
} from "@/features/start-a-project/records";

describe("newClientNotes", () => {
  it("records the company name", () => {
    expect(newClientNotes("Blackridge Hotels")).toBe("Company: Blackridge Hotels");
  });

  it("uses a dash when there is no company", () => {
    expect(newClientNotes("")).toBe("Company: -");
  });
});

describe("enquiryActivityMessage", () => {
  it("names who sent it", () => {
    expect(enquiryActivityMessage("Thandi Mokoena")).toBe(
      "New project enquiry from Thandi Mokoena",
    );
  });

  it("falls back for an anonymous name", () => {
    expect(enquiryActivityMessage("")).toBe("New project enquiry from website visitor");
  });

  it("stays within the database's 200-character limit", () => {
    expect(enquiryActivityMessage("x".repeat(300)).length).toBe(200);
  });
});

const input = (over: Partial<ProjectEnquiryInput> = {}): ProjectEnquiryInput => ({
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  ...over,
});

const file = (over: Partial<UploadedFile> = {}): UploadedFile => ({
  storage_path: "abc/0-brief.pdf",
  file_name: "brief.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
  ...over,
});

describe("submitEnquiryArgs", () => {
  it("maps every field to the submit_enquiry() parameter names", () => {
    expect(submitEnquiryArgs(input(), [file()])).toEqual({
      full_name: "Thandi Mokoena",
      company: "Blackridge Hotels",
      email: "thandi@example.com",
      phone: "0761234567",
      project_type: "Documentary",
      location: "Polokwane",
      timeline: "Next 1-3 months",
      description: "A short documentary series.",
      budget: "R20,000 - R35,000",
      client_notes: "Company: Blackridge Hotels",
      attachments: [file()],
    });
  });

  it("sends null for an empty company or budget, and an empty attachments array", () => {
    const args = submitEnquiryArgs(input({ company: "", budget: "" }), []);
    expect(args.company).toBeNull();
    expect(args.budget).toBeNull();
    expect(args.attachments).toEqual([]);
    expect(args.client_notes).toBe("Company: -");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/start-a-project/records.test.ts`
Expected: FAIL — `Cannot find module '@/features/start-a-project/records'`

- [ ] **Step 4: Write `records.ts`**

```typescript
import type { ProjectEnquiryInput } from "./schemas";

const dash = (value: string) => value || "-";

/** Notes stored on a newly created client row, matching the existing lead-capture convention. */
export function newClientNotes(company: string): string {
  return `Company: ${dash(company)}`;
}

/** The database rejects activity messages over 200 characters. */
export function enquiryActivityMessage(fullName: string): string {
  const message = `New project enquiry from ${fullName || "website visitor"}`;
  return message.length <= 200 ? message : `${message.slice(0, 197)}...`;
}

export type UploadedFile = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

/** The exact argument object for the submit_enquiry() RPC call. */
export function submitEnquiryArgs(input: ProjectEnquiryInput, uploaded: UploadedFile[]) {
  return {
    full_name: input.full_name,
    company: input.company || null,
    email: input.email,
    phone: input.phone,
    project_type: input.project_type,
    location: input.location,
    timeline: input.timeline,
    description: input.description,
    budget: input.budget || null,
    client_notes: newClientNotes(input.company),
    attachments: uploaded,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/start-a-project/records.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/features/start-a-project/schemas.ts src/features/start-a-project/records.ts src/features/start-a-project/records.test.ts
git commit -m "feat: Start a Project schema and record shaping

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Server Action

**Files:**
- Create: `src/features/start-a-project/actions.ts`
- Test: `src/features/start-a-project/actions.test.ts`

**Interfaces:**
- Consumes: `checkFileCount`, `checkFileMeta`, `checkFileContent`,
  `sanitizeFileName` (Task 2); `projectEnquirySchema` (Task 3);
  `enquiryActivityMessage`, `submitEnquiryArgs`, `UploadedFile` (Task 3);
  `createSupabaseAnonClient` from `@/lib/db/anon` (existing).
- Produces: `EnquiryResult = { ok: true } | { ok: false; error: string }`,
  `submitProjectEnquiry(formData: FormData): Promise<EnquiryResult>`. Task 5
  (form) calls this directly.

- [ ] **Step 1: Write the failing tests**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

const rpc = vi.fn();
const upload = vi.fn();
const insert = vi.fn();
const anonClient = {
  storage: { from: () => ({ upload }) },
  rpc: (...args: unknown[]) => rpc(...args),
  from: (table: string) => ({ insert: (row: unknown) => insert(table, row) }),
};
vi.mock("@/lib/db/anon", () => ({ createSupabaseAnonClient: () => anonClient }));

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

function pdfFile(name = "brief.pdf", bytes = PDF_BYTES) {
  return new File([bytes], name, { type: "application/pdf" });
}

function baseFormData(over: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    full_name: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    project_type: PROJECT_TYPES[0],
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    hp_website: "",
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "new-id", error: null });
  upload.mockReset().mockResolvedValue({ data: { path: "x" }, error: null });
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("submitProjectEnquiry", () => {
  it("uploads each attachment, then calls submit_enquiry, then logs activity", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append("attachments", pdfFile());

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toMatch(/^[0-9a-f-]+\/0-brief\.pdf$/);
    expect(rpc).toHaveBeenCalledWith(
      "submit_enquiry",
      expect.objectContaining({
        full_name: "Thandi Mokoena",
        attachments: [
          expect.objectContaining({ file_name: "brief.pdf", mime_type: "application/pdf" }),
        ],
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      "ops_activity_log",
      expect.objectContaining({ message: expect.stringContaining("Thandi Mokoena") }),
    );
  });

  it("succeeds with no attachments at all", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const result = await submitProjectEnquiry(baseFormData());

    expect(result).toEqual({ ok: true });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("submit_enquiry", expect.objectContaining({ attachments: [] }));
  });

  it("rejects invalid form fields without touching the database", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const result = await submitProjectEnquiry(baseFormData({ email: "not-an-email" }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pretends to succeed for a honeypot hit, storing nothing", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const result = await submitProjectEnquiry(baseFormData({ hp_website: "http://spam.example" }));

    expect(result).toEqual({ ok: true });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects too many files without uploading any of them", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    for (let i = 0; i < 6; i++) formData.append("attachments", pdfFile(`brief-${i}.pdf`));

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("5 files") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before uploading anything", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append("attachments", pdfFile("huge.pdf", new Uint8Array(15 * 1024 * 1024 + 1)));

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("15 MB") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a disallowed extension before uploading anything", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append(
      "attachments",
      new File([PDF_BYTES], "script.exe", { type: "application/octet-stream" }),
    );

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("script.exe") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file whose real bytes don't match its claimed type, before uploading anything", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    const fakeExe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]); // "MZ"
    formData.append("attachments", pdfFile("invoice.pdf", fakeExe));

    const result = await submitProjectEnquiry(formData);

    expect(result.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("fails cleanly when an upload fails", async () => {
    upload.mockResolvedValue({ data: null, error: { message: "storage down" } });
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append("attachments", pdfFile());

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails cleanly when submit_enquiry fails, without failing on the activity log", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "constraint violation" } });
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await submitProjectEnquiry(baseFormData());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/start-a-project/actions.test.ts`
Expected: FAIL — `Cannot find module '@/features/start-a-project/actions'`

- [ ] **Step 3: Write `actions.ts`**

```typescript
"use server";

import { createSupabaseAnonClient } from "@/lib/db/anon";
import {
  checkFileContent,
  checkFileCount,
  checkFileMeta,
  sanitizeFileName,
} from "@/features/start-a-project/file-validation";
import {
  enquiryActivityMessage,
  submitEnquiryArgs,
  type UploadedFile,
} from "@/features/start-a-project/records";
import { projectEnquirySchema } from "@/features/start-a-project/schemas";

export type EnquiryResult = { ok: true } | { ok: false; error: string };

const INVALID: EnquiryResult = {
  ok: false,
  error: "Some details look incomplete. Please check the form and try again.",
};
const FAILED: EnquiryResult = {
  ok: false,
  error: "We couldn't send that just now. Please try again in a moment.",
};

const BUCKET = "enquiry-attachments";

function fieldsFromFormData(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

/**
 * Validates the form and every attachment, uploads the attachments to
 * private Storage, then writes the client/enquiry/attachment rows through
 * submit_enquiry(). Every file is fully validated (size, extension, then
 * its real content) before any of them are uploaded, so a later rejection
 * never leaves an earlier file stranded in Storage.
 */
export async function submitProjectEnquiry(formData: FormData): Promise<EnquiryResult> {
  const input = projectEnquirySchema.safeParse(fieldsFromFormData(formData));
  if (!input.success) return INVALID;
  if (input.data.hp_website) return { ok: true }; // bot: pretend it worked, store nothing

  const files = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const countCheck = checkFileCount(files.length);
  if (!countCheck.ok) return { ok: false, error: countCheck.error };

  const readFiles: { file: File; bytes: Uint8Array }[] = [];
  for (const file of files) {
    const metaCheck = checkFileMeta(file.name, file.size);
    if (!metaCheck.ok) return { ok: false, error: metaCheck.error };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentCheck = checkFileContent(file.name, bytes);
    if (!contentCheck.ok) return { ok: false, error: contentCheck.error };
    readFiles.push({ file, bytes });
  }

  const supabase = createSupabaseAnonClient();
  const submissionId = crypto.randomUUID();
  const uploaded: UploadedFile[] = [];

  for (const [index, { file, bytes }] of readFiles.entries()) {
    const storagePath = `${submissionId}/${index}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      console.error("start-a-project: file upload failed:", error.message);
      return FAILED;
    }
    uploaded.push({
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
  }

  const { error: rpcError } = await supabase.rpc(
    "submit_enquiry",
    submitEnquiryArgs(input.data, uploaded),
  );
  if (rpcError) {
    console.error("start-a-project: submit_enquiry failed:", rpcError.message);
    return FAILED;
  }

  // Best-effort: the enquiry itself is already saved even if this fails.
  const { error: activityError } = await supabase
    .from("ops_activity_log")
    .insert({ message: enquiryActivityMessage(input.data.full_name) });
  if (activityError) {
    console.error("start-a-project: activity log insert failed:", activityError.message);
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/start-a-project/actions.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/start-a-project/actions.ts src/features/start-a-project/actions.test.ts
git commit -m "feat: submitProjectEnquiry server action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Public form and page

**Files:**
- Create: `src/features/start-a-project/components/start-a-project-form.tsx`
- Create: `src/app/(public)/(storefront)/start-a-project/page.tsx`
- Test: `src/features/start-a-project/start-a-project-form.test.tsx`
- Modify: `src/styles/public/overrides.css` (append; do not touch existing rules)

**Interfaces:**
- Consumes: `submitProjectEnquiry` (Task 4); `MAX_FILES`, `checkFileCount`,
  `checkFileMeta` (Task 2); `PROJECT_TYPES` (Task 3); existing `Select`
  component at `@/components/site/forms/select`; existing `CONTACT_EMAIL`
  at `@/content/site`; existing `Reveal` at `@/components/site/reveal`;
  existing `SiteFooter` at `@/components/site/site-footer`.
- Produces: page reachable at `/start-a-project` (no nav link, per Global
  Constraints).

- [ ] **Step 1: Write the failing component tests**

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitProjectEnquiry = vi.fn();
vi.mock("@/features/start-a-project/actions", () => ({
  submitProjectEnquiry: (formData: FormData) => submitProjectEnquiry(formData),
}));

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
function pdfFile(name = "brief.pdf", size = 1024) {
  const bytes = size > PDF_BYTES.length ? new Uint8Array(size) : PDF_BYTES;
  if (size > PDF_BYTES.length) bytes.set(PDF_BYTES);
  return new File([bytes], name, { type: "application/pdf" });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Thandi Mokoena" } });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "thandi@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Phone / WhatsApp"), { target: { value: "0761234567" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Polokwane" } });
  fireEvent.change(screen.getByLabelText("Timeline"), { target: { value: "Next month" } });
  fireEvent.change(screen.getByLabelText("Tell us about the project"), {
    target: { value: "A short documentary series." },
  });
}

beforeEach(() => submitProjectEnquiry.mockReset());

describe("StartAProjectForm", () => {
  it("renders every field from the website scope, including the honeypot", async () => {
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    const { container } = render(<StartAProjectForm />);

    for (const label of [
      "Your name",
      "Company / brand",
      "Email address",
      "Phone / WhatsApp",
      "Location",
      "Timeline",
      "Tell us about the project",
      "Budget",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(container.querySelector('input[name="hp_website"]')).toBeInTheDocument();
  });

  it("rejects an oversized file at the file picker, before any submit", async () => {
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    render(<StartAProjectForm />);
    const input = screen.getByLabelText("Attachments") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pdfFile("huge.pdf", 15 * 1024 * 1024 + 1)] } });

    expect(await screen.findByText(/15 MB/)).toBeInTheDocument();
    expect(screen.queryByText("huge.pdf")).toBeNull();
  });

  it("lists a valid attachment and can remove it", async () => {
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    render(<StartAProjectForm />);
    const input = screen.getByLabelText("Attachments") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pdfFile()] } });
    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("brief.pdf")).toBeNull();
  });

  it("submits the form (with a chosen file) and shows the success state", async () => {
    submitProjectEnquiry.mockResolvedValue({ ok: true });
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), { target: { files: [pdfFile()] } });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(submitProjectEnquiry).toHaveBeenCalledTimes(1));
    const sentFormData = submitProjectEnquiry.mock.calls[0]![0] as FormData;
    expect(sentFormData.get("full_name")).toBe("Thandi Mokoena");
    expect(sentFormData.getAll("attachments")).toHaveLength(1);
    expect(await screen.findByText("Project received")).toBeInTheDocument();
  });

  it("shows the server's error and lets the visitor try again", async () => {
    submitProjectEnquiry.mockResolvedValue({ ok: false, error: "Please try again in a moment." });
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Please try again in a moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send project details/ })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/start-a-project/start-a-project-form.test.tsx`
Expected: FAIL — `Cannot find module '.../start-a-project-form'`

- [ ] **Step 3: Append the file-attachment styles**

Append to the end of `src/styles/public/overrides.css` (this file already
holds every addition the React port needs on top of the ported legacy
stylesheets — do not modify anything above your addition):

```css

/* Start a Project: page wrapper and the file-attachment control. Neither
   existed on the legacy site, so there is no ported rule to match — kept
   deliberately plain, reusing the existing .contact-form field styling. */
.start-a-project-page {
  min-height: 100vh;
  padding: 90px clamp(24px, 7vw, 140px);
}

.project-enquiry-form__files {
  display: grid;
  gap: 10px;
}

.project-enquiry-form__file-hint {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin: 0;
}

.project-enquiry-form__file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.project-enquiry-form__file-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
}

.project-enquiry-form__file-list button {
  border: 0;
  background: none;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
}
```

- [ ] **Step 4: Write the form component**

```tsx
"use client";

import { useRef, useState } from "react";
import { Select } from "@/components/site/forms/select";
import { CONTACT_EMAIL } from "@/content/site";
import { submitProjectEnquiry } from "@/features/start-a-project/actions";
import { MAX_FILES, checkFileCount, checkFileMeta } from "@/features/start-a-project/file-validation";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

type Status = "idle" | "sending" | "sent" | "failed";

const GENERIC_FAILURE = (
  <>
    Something went wrong sending your project. Please try again or email us directly at{" "}
    {CONTACT_EMAIL}.
  </>
);

/**
 * The single, short "Start a Project" form: the one form in the new design
 * that collects file attachments (a project brief, references, and
 * similar). Fields match the website refinement scope's §11 exactly.
 */
export function StartAProjectForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [projectType, setProjectType] = useState<string>(PROJECT_TYPES[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    const combined = [...files, ...chosen];
    const countCheck = checkFileCount(combined.length);
    if (!countCheck.ok) {
      setFileError(countCheck.error);
      event.target.value = "";
      return;
    }
    for (const file of chosen) {
      const metaCheck = checkFileMeta(file.name, file.size);
      if (!metaCheck.ok) {
        setFileError(metaCheck.error);
        event.target.value = "";
        return;
      }
    }
    setFileError("");
    setFiles(combined);
    event.target.value = ""; // lets the same file be re-picked after a removal
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
    setFileError("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setServerError(null);
    const formData = new FormData(formRef.current ?? undefined);
    for (const file of files) formData.append("attachments", file);
    try {
      const result = await submitProjectEnquiry(formData);
      if (result.ok) {
        setStatus("sent");
      } else {
        setStatus("failed");
        setServerError(result.error);
      }
    } catch (error) {
      console.error("Start a Project submission failed", error);
      setStatus("failed");
      setServerError(null);
    }
  };

  if (status === "sent") {
    return (
      <div className="contact-form__section contact-form__section--success">
        <h3>Project received</h3>
        <p>Thank you for reaching out. We will be in touch within 24 hours.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} className="contact-form" noValidate onSubmit={(event) => void submit(event)}>
      {/* Spam trap: invisible to people, tempting to bots. */}
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <label>
        <span>Your name</span>
        <input type="text" name="full_name" autoComplete="name" required />
      </label>
      <label>
        <span>Company / brand</span>
        <input type="text" name="company" autoComplete="organization" placeholder="Optional" />
      </label>
      <label>
        <span>Email address</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label>
        <span>Phone / WhatsApp</span>
        <input type="tel" name="phone" autoComplete="tel" required />
      </label>
      <label>
        <span>Project type</span>
        <Select
          name="project_type"
          required
          options={PROJECT_TYPES}
          value={projectType}
          onChange={setProjectType}
          label="Project type"
        />
      </label>
      <label>
        <span>Location</span>
        <input type="text" name="location" required />
      </label>
      <label>
        <span>Timeline</span>
        <input type="text" name="timeline" placeholder="e.g. Next 1-3 months" required />
      </label>
      <label className="contact-form__wide">
        <span>Tell us about the project</span>
        <textarea name="description" rows={5} required></textarea>
      </label>
      <label>
        <span>Budget</span>
        <input type="text" name="budget" placeholder="Optional" />
      </label>

      <div className="project-enquiry-form__files contact-form__wide">
        <label>
          <span>Attachments</span>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={onFilesChosen}
          />
        </label>
        <p className="project-enquiry-form__file-hint">
          PDF, JPG, PNG, DOC, DOCX, XLS or XLSX — up to {MAX_FILES} files, 15 MB each.
        </p>
        {files.length ? (
          <ul className="project-enquiry-form__file-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                <button type="button" onClick={() => removeFile(index)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fileError ? <p className="contact-form__error">{fileError}</p> : null}
      </div>

      {status === "failed" ? (
        <p className="contact-form__error" data-contact-error="">
          {serverError ?? GENERIC_FAILURE}
        </p>
      ) : null}

      <div className="contact-form__actions">
        <button className="contact-submit" type="submit" disabled={status === "sending"}>
          <span>{status === "sending" ? "Sending..." : "Send project details"}</span>
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Write the page**

```tsx
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/site-footer";
import { StartAProjectForm } from "@/features/start-a-project/components/start-a-project-form";

export const metadata: Metadata = {
  title: { absolute: "Start a Project — LGNDRY.Co" },
  description: "Tell us about your project and we'll be in touch within 24 hours.",
  alternates: { canonical: "/start-a-project" },
};

export default function StartAProjectPage() {
  return (
    <>
      <main className="start-a-project-page" id="main-content">
        <header className="commerce-page__head">
          <span>Start a project</span>
          <h1>Tell us about your project.</h1>
          <p>Share a few details and any reference files — we&apos;ll follow up within 24 hours.</p>
        </header>
        <StartAProjectForm />
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/start-a-project/start-a-project-form.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/features/start-a-project/components/start-a-project-form.tsx \
  src/features/start-a-project/start-a-project-form.test.tsx \
  "src/app/(public)/(storefront)/start-a-project/page.tsx" \
  src/styles/public/overrides.css
git commit -m "feat: Start a Project public form and page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Admin verification page

**Files:**
- Create: `src/features/start-a-project/admin/build-enquiry-rows.ts`
- Test: `src/features/start-a-project/admin/build-enquiry-rows.test.ts`
- Create: `src/app/(app)/ops/enquiries/page.tsx`

**Interfaces:**
- Consumes: `requireOpsUser` from `@/lib/auth/guards` (existing);
  `createSupabaseServerClient` from `@/lib/db/server` (existing);
  `PageHeader` from `@/components/layout/page-header` (existing);
  `EmptyState` from `@/components/feedback/empty-state` (existing).
- Produces: `EnquiryRow = { id: string; fullName: string; company: string |
  null; email: string; projectType: string; status: string; submittedAt:
  string; attachments: { fileName: string; url: string | null }[] }`,
  `buildEnquiryRows(enquiries, attachmentsByEnquiry, signedUrlByPath):
  EnquiryRow[]`; the page itself, at `/ops/enquiries`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { buildEnquiryRows } from "@/features/start-a-project/admin/build-enquiry-rows";

const enquiry = {
  id: "e1",
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  project_type: "Documentary",
  status: "New",
  created_at: "2026-09-27T10:00:00Z",
};

describe("buildEnquiryRows", () => {
  it("maps an enquiry with its attachments and signed urls", () => {
    const rows = buildEnquiryRows(
      [enquiry],
      new Map([["e1", [{ file_name: "brief.pdf", storage_path: "abc/0-brief.pdf" }]]]),
      new Map([["abc/0-brief.pdf", "https://signed.example/abc/0-brief.pdf"]]),
    );

    expect(rows).toEqual([
      {
        id: "e1",
        fullName: "Thandi Mokoena",
        company: "Blackridge Hotels",
        email: "thandi@example.com",
        projectType: "Documentary",
        status: "New",
        submittedAt: "2026-09-27T10:00:00Z",
        attachments: [{ fileName: "brief.pdf", url: "https://signed.example/abc/0-brief.pdf" }],
      },
    ]);
  });

  it("gives an enquiry with no attachments an empty list", () => {
    const rows = buildEnquiryRows([enquiry], new Map(), new Map());
    expect(rows[0]!.attachments).toEqual([]);
  });

  it("gives null for a file whose signed url could not be created", () => {
    const rows = buildEnquiryRows(
      [enquiry],
      new Map([["e1", [{ file_name: "brief.pdf", storage_path: "abc/0-brief.pdf" }]]]),
      new Map(),
    );
    expect(rows[0]!.attachments).toEqual([{ fileName: "brief.pdf", url: null }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/start-a-project/admin/build-enquiry-rows.test.ts`
Expected: FAIL — `Cannot find module '.../build-enquiry-rows'`

- [ ] **Step 3: Write `build-enquiry-rows.ts`**

```typescript
export type EnquiryRow = {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  projectType: string;
  status: string;
  submittedAt: string;
  attachments: { fileName: string; url: string | null }[];
};

type EnquiryRecord = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  project_type: string;
  status: string;
  created_at: string;
};

type AttachmentRecord = { file_name: string; storage_path: string };

/** Pure view-model builder, kept separate from data fetching so it's easy to test. */
export function buildEnquiryRows(
  enquiries: EnquiryRecord[],
  attachmentsByEnquiry: Map<string, AttachmentRecord[]>,
  signedUrlByPath: Map<string, string | null>,
): EnquiryRow[] {
  return enquiries.map((enquiry) => ({
    id: enquiry.id,
    fullName: enquiry.full_name,
    company: enquiry.company,
    email: enquiry.email,
    projectType: enquiry.project_type,
    status: enquiry.status,
    submittedAt: enquiry.created_at,
    attachments: (attachmentsByEnquiry.get(enquiry.id) ?? []).map((attachment) => ({
      fileName: attachment.file_name,
      url: signedUrlByPath.get(attachment.storage_path) ?? null,
    })),
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/start-a-project/admin/build-enquiry-rows.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Write the admin page**

```tsx
import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buildEnquiryRows } from "@/features/start-a-project/admin/build-enquiry-rows";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Enquiries" };

const BUCKET = "enquiry-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * Bare proof that the pipeline works end to end: every Start a Project
 * submission, newest first, with a link to open each attachment. No
 * search, filters, tabs or styling — the full Enquiries page (matching
 * docs/design-references/enquiries.png / view-enquiry.png) is a later
 * sub-project.
 */
export default async function EnquiriesPage() {
  await requireOpsUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: enquiries }, { data: attachments }] = await Promise.all([
    supabase
      .from("enquiries")
      .select("id, full_name, company, email, project_type, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("enquiry_attachments").select("enquiry_id, file_name, storage_path"),
  ]);

  const attachmentsByEnquiry = new Map<string, { file_name: string; storage_path: string }[]>();
  for (const attachment of attachments ?? []) {
    const list = attachmentsByEnquiry.get(attachment.enquiry_id) ?? [];
    list.push(attachment);
    attachmentsByEnquiry.set(attachment.enquiry_id, list);
  }

  const signedUrlByPath = new Map<string, string | null>();
  for (const attachment of attachments ?? []) {
    if (signedUrlByPath.has(attachment.storage_path)) continue;
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS);
    signedUrlByPath.set(attachment.storage_path, data?.signedUrl ?? null);
  }

  const rows = buildEnquiryRows(enquiries ?? [], attachmentsByEnquiry, signedUrlByPath);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Enquiries"
        description="Every submission from the Start a Project form, newest first."
      />
      {rows.length === 0 ? (
        <EmptyState title="No enquiries yet">
          Submissions from /start-a-project will appear here.
        </EmptyState>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-line border-b text-left">
              <th className="py-2 pr-4">Name / Company</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Project type</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Submitted</th>
              <th className="py-2 pr-4">Attachments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-line border-b align-top">
                <td className="py-2 pr-4">
                  {row.fullName}
                  {row.company ? <div className="text-ink-muted">{row.company}</div> : null}
                </td>
                <td className="py-2 pr-4">{row.email}</td>
                <td className="py-2 pr-4">{row.projectType}</td>
                <td className="py-2 pr-4">{row.status}</td>
                <td className="py-2 pr-4">{new Date(row.submittedAt).toLocaleString("en-ZA")}</td>
                <td className="py-2 pr-4">
                  {row.attachments.length === 0 ? (
                    "—"
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {row.attachments.map((attachment, index) => (
                        <li key={index}>
                          {attachment.url ? (
                            <a
                              className="underline"
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {attachment.fileName}
                            </a>
                          ) : (
                            attachment.fileName
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/start-a-project/admin/build-enquiry-rows.ts \
  src/features/start-a-project/admin/build-enquiry-rows.test.ts \
  "src/app/(app)/ops/enquiries/page.tsx"
git commit -m "feat: bare /ops/enquiries admin verification page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Full verification, documentation, and ship

**Files:**
- Modify: `docs/architecture/application-architecture.md` (append a new
  section; do not edit existing sections)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: nothing further consumes this task; it is the final gate.

- [ ] **Step 1: Run the full gate suite**

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all five pass with no errors. Fix anything that doesn't before
continuing — do not proceed with a red gate.

- [ ] **Step 2: Raise the Server Action body-size limit**

Nothing so far has sent a realistically-sized file: every test uses files
of a few KB. Next.js caps a Server Action's request body by default
(historically 1 MB) — far below what one 15 MB attachment needs, let alone
five. Raise it now, before the one real submission this task makes:

Add to `next.config.ts` (inside the existing `nextConfig` object):

```typescript
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
```

Run `pnpm build`. If Next.js 16.3.6 has moved this key out of
`experimental` (some config flags stabilize between versions), the build
output will say so directly — follow what it says and move the key
accordingly; otherwise leave it as above.

- [ ] **Step 3: Local dev-server smoke test**

With the dev server running (`preview_start` in this environment, or
`pnpm dev` elsewhere), confirm in the browser: `/start-a-project` renders
every field; choosing a 20 MB file shows the "over the 15 MB limit" message
without a network request; choosing 6 files shows the "at most 5 files"
message. Do not submit the form yet.

- [ ] **Step 4: One real end-to-end submission — ask first**

This step writes a real row to the live database. Before doing it, tell the
user explicitly that you are about to submit one real test enquiry to
confirm the pipeline end-to-end (including that the body-size-limit change
in Step 2 actually works against a realistic file, not just a tiny one),
and that you will delete it afterwards. Wait for their go-ahead.

Once confirmed:
1. Submit `/start-a-project` with two real attachments: one real PDF of
   roughly 8–14 MB (large enough to meaningfully exceed Next's old 1 MB
   default and prove Step 2's config change took effect — e.g. a real
   multi-page scanned document) and one small real JPG.
   - If this fails with a request-too-large error even after confirming
     the Step 2 config took effect, **stop here** — do not attempt a
     workaround inline. This means Vercel's platform itself is capping the
     request, and the fallback in the design spec (a short-lived signed
     upload URL straight from the browser to Storage, bypassing the Server
     Action for the file bytes) needs its own brainstorming/plan pass,
     since it changes Task 4 and Task 5's architecture. Report this
     finding to the user and stop the plan there.
2. Sign in as an admin and open `/ops/enquiries`. Confirm the new row
   appears with both attachment names, and that clicking each one opens the
   real file.
3. Delete the test data:

```sql
delete from public.enquiry_attachments
where enquiry_id in (select id from public.enquiries where email = '<the test email used>');
delete from public.enquiries where email = '<the test email used>';
delete from public.clients where email = '<the test email used>';
```

(Leave the uploaded Storage objects — they are harmless orphaned bytes, the
accepted minor gap documented in the design spec; not worth building
cleanup tooling for in this sub-project.)

- [ ] **Step 5: Document this sub-project**

Append to `docs/architecture/application-architecture.md`:

```markdown

## Phase 5, sub-project 1 — Attachment pipeline and enquiry record

The first piece of the OPS Command Center rebuild (see
`docs/LGNDRY_Command_Center_Refinement_Scope.md` and
`docs/superpowers/specs/2026-09-27-attachment-pipeline-and-enquiry-record-design.md`).
A public "Start a Project" form (`/start-a-project`) now exists, matching the
website refinement scope's §11 field list, and is the first form on the site
that accepts file attachments.

### What's new

- `enquiries` and `enquiry_attachments` tables, and a private
  `enquiry-attachments` Storage bucket (15 MB/file, PDF/JPG/JPEG/PNG/DOC/
  DOCX/XLS/XLSX only, enforced at the bucket level and again in code).
- All public writes go through one `SECURITY DEFINER` function,
  `submit_enquiry()` — there are no direct anon policies on
  `clients`/`enquiries`/`enquiry_attachments`, because matching an enquiry to
  an existing client needs to read `clients` by email first, which `anon`
  must never do directly.
- Every attachment is validated twice: cheaply in the browser (extension,
  size), and authoritatively on the server (extension, size, and a
  magic-byte check that the file's real content matches what its extension
  claims — catching a mislabelled or disguised file a declared MIME type
  alone would not).
- A bare admin page, `/ops/enquiries`, lists every submission and opens each
  attachment through a short-lived signed URL. Deliberately unstyled — the
  full Enquiries page (matching `docs/design-references/enquiries.png` /
  `view-enquiry.png`) is its own later sub-project.

### Deliberately unchanged

The existing Contact page, Booking dialog and Partnership dialog keep
writing into `clients`/`bookings`/`partnerships` exactly as before — a
temporary, intentional parallel path. Nothing links to `/start-a-project`
yet; nav/CTA wiring is the later website-structure sub-project. Existing
`clients`/`bookings`/`partnerships` rows were not migrated into `enquiries`.

### Still open

- The styled Enquiries list + detail page (next sub-project).
- Quotes, bookings, payments, communication history and follow-ups will
  reference `enquiries.id` when each is built; none of that exists yet.
- Retiring the legacy forms, and the website nav/IA change to Work /
  Practice / Fine Art / About / Start a Project.
```

- [ ] **Step 6: Commit and push**

```bash
git add docs/architecture/application-architecture.md
git commit -m "docs: attachment pipeline and enquiry record

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin next-migration
```

- [ ] **Step 7: Report to the user**

Summarise: what shipped, what was deliberately deferred (styled Enquiries
page, nav wiring, legacy form retirement, quotes/bookings/payments/
follow-ups/communication history), the one real test enquiry created and
deleted, and confirm all gates are green.
