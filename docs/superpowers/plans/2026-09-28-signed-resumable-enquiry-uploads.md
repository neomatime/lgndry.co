# Signed Resumable Enquiry Uploads Implementation Plan

**Goal:** Remove attachment bytes from Vercel requests while preserving the
15 MB-per-file, five-file enquiry contract, authoritative validation, private
Storage access, and an all-or-nothing enquiry record.

**Architecture:** A text-only preparation Server Action validates the form,
rate-limits a keyed IP hash, creates a private upload session, and returns
path-specific Supabase signed upload tokens. The browser sends each file to the
direct Supabase Storage hostname with TUS. A text-only finalization Server
Action authenticates the session capability, verifies every stored object, then
calls one service-role-only database function that creates the enquiry and marks
the session complete in the same transaction. An hourly Supabase Cron job calls
an Edge Function that removes abandoned session files after 24 hours.

**Tech stack:** Next.js 16.3.6 App Router and Server Actions, React 19.3,
TypeScript 6 strict mode, zod 4, `@supabase/supabase-js` 2.117.2,
`tus-js-client` 4.3.1, Supabase Postgres/Storage/Edge Functions/Cron, Vitest 5,
Testing Library, pnpm 10.

**Spec:**
`docs/superpowers/specs/2026-09-28-signed-resumable-enquiry-uploads-design.md`

## Global constraints

- Stay on `next-migration`. Do not merge to `main` or open a pull request.
- Supabase project `tscaluhtfrvwlwjybfsg` is live. Do not create persistent
  test enquiries, clients, sessions, or Storage objects without explicit
  approval immediately before the test. SQL verification uses transactions and
  must end in `rollback`.
- Keep `/start-a-project` unlinked from public navigation and calls to action.
- Keep the accepted types exactly PDF, JPG/JPEG, PNG, DOC/DOCX, XLS/XLSX, with
  15 MB per file and at most five files.
- The service-role key and rate-limit secret are server-only. They never use a
  `NEXT_PUBLIC_` prefix, enter a Client Component, appear in logs, or get
  committed.
- Use `x-vercel-forwarded-for`, falling back to `x-forwarded-for` and then a
  local-development sentinel. Vercel documents that it supplies and protects
  these headers from direct spoofing.
- Use a 6 MB TUS chunk size, the direct `*.storage.supabase.co` hostname, signed
  `x-signature`, no upsert, bounded retries, and resume fingerprints.
- New database functions are `SECURITY INVOKER`, fully qualify object names,
  revoke `PUBLIC`, and grant only `service_role`. The existing
  `submit_enquiry()` remains `SECURITY DEFINER` but loses public execute access
  only in a deferred cutover migration.
- New public-schema tables have RLS enabled even though no visitor-facing policy
  exists. Explicitly revoke `anon` and `authenticated` table privileges.
- Every database read test asserts row counts; an RLS-filtered zero-row result
  is not treated as a permission error.
- Stage files by explicit name. Never use `git add .` or `git add -A`. Never
  stage the OAuth files, working images, screenshot, scope documents,
  `inbox.png`, or `verify.txt` listed in the handoff.
- No attribution trailers in commits.
- At the end of every task, run the complete gate suite:

```powershell
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Review focus

1. No `File`, `Blob`, file bytes, base64 body, or complete attachment enters a
   Server Action request.
2. A no-attachment enquiry still uses the rate-limited session/finalization
   path and remains valid.
3. Duplicate or concurrent finalization returns the same enquiry id and never
   creates a second client/enquiry.
4. A successful database commit followed by a lost HTTP response is recognized
   as success on retry; cleanup must never delete files linked to a committed
   enquiry.
5. A missing or invalid one of five attachments creates no enquiry and leaves
   the other four eligible for cleanup.
6. Direct anon Storage upload and direct anon `submit_enquiry()` remain
   available until production cutover, then are removed together by the
   deferred migration.
7. The cleanup worker never accepts caller-supplied paths, never touches a
   completed session, and marks a session expired only after Storage deletion
   succeeds or every object is already absent.
8. Browser progress updates do not reorder files or resize the form, and the
   retry action does not clear completed fields or completed uploads.

---

## Task 1: Commit the approved design and plan

**Files:**

- Add:
  `docs/superpowers/specs/2026-09-28-signed-resumable-enquiry-uploads-design.md`
- Add:
  `docs/superpowers/plans/2026-09-28-signed-resumable-enquiry-uploads.md`

- [ ] Run the full gate suite.
- [ ] Stage only the two files above.
- [ ] Commit:

```text
docs: design signed resumable enquiry uploads
```

---

## Task 2: Pin TUS and add server-only configuration

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Create: `src/lib/server-env.ts`
- Create: `src/lib/server-env.test.ts`
- Create: `src/lib/db/service.ts`
- Create: `src/lib/db/service.test.ts`

**Interfaces produced:**

```typescript
export type ServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: string;
};

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv;
export function getServerEnv(): ServerEnv;
export function createSupabaseServiceClient(): SupabaseClient;
```

- [ ] Install the stable package exactly and commit the lockfile:

```powershell
pnpm add --save-exact tus-js-client@4.3.1
```

- [ ] Keep the existing service-role entry, update its comment for the signed
  enquiry-upload pipeline, and add the rate-limit secret without values:

```dotenv
# Required by the signed Start a Project upload pipeline. Server only.
SUPABASE_SERVICE_ROLE_KEY=
ENQUIRY_UPLOAD_RATE_LIMIT_SECRET=
```

- [ ] Write the failing server-env tests:

```typescript
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/server-env";

describe("parseServerEnv", () => {
  it("accepts both high-entropy server values", () => {
    expect(
      parseServerEnv({
        SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
        ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "x".repeat(32),
      }),
    ).toEqual({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
      ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "x".repeat(32),
    });
  });

  it("names missing or weak variables", () => {
    expect(() => parseServerEnv({})).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() =>
      parseServerEnv({
        SUPABASE_SERVICE_ROLE_KEY: "key",
        ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "short",
      }),
    ).toThrow(/ENQUIRY_UPLOAD_RATE_LIMIT_SECRET/);
  });
});
```

- [ ] Implement lazy server configuration in `src/lib/server-env.ts`:

```typescript
import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: process.env.ENQUIRY_UPLOAD_RATE_LIMIT_SECRET,
  });
}
```

- [ ] Implement a no-session, server-only service client:

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/server-env";

export function createSupabaseServiceClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] Test that the client factory passes the public URL and service key to the
  SDK and never imports browser helpers.
- [ ] Run the full gate suite.
- [ ] Stage the seven named files and commit:

```text
build: add signed upload runtime dependencies
```

---

## Task 3: Pure upload contract, capabilities, and TUS adapter

**Files:**

- Create: `src/features/start-a-project/upload-contract.ts`
- Create: `src/features/start-a-project/upload-contract.test.ts`
- Create: `src/features/start-a-project/tus-upload.ts`
- Create: `src/features/start-a-project/tus-upload.test.ts`
- Modify: `src/features/start-a-project/file-validation.ts`
- Modify: `src/features/start-a-project/file-validation.test.ts`

**Interfaces produced:**

```typescript
export type UploadDescriptor = {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
};

export type PreparedUpload = UploadDescriptor & {
  index: number;
  storagePath: string;
  token: string;
};

export type PrepareEnquiryResult =
  | { status: "ready"; sessionId: string; sessionSecret: string; uploads: PreparedUpload[] }
  | { status: "accepted" }
  | { status: "error"; code: "invalid" | "rate-limited" | "failed"; error: string };

export type FinalizeEnquiryResult =
  | { status: "complete" }
  | { status: "error"; code: "invalid" | "expired" | "failed"; error: string };

export function descriptorForFile(file: File): UploadDescriptor;
export function storagePathFor(sessionId: string, index: number, fileName: string): string;
export function directStorageEndpoint(supabaseUrl: string): string;
export type TusUploadHandle = {
  done: Promise<void>;
  abort: () => Promise<void>;
};

export function startTusUpload(options: TusUploadOptions): TusUploadHandle;
```

- [ ] Add tests for descriptor normalization, canonical MIME types, safe paths,
  duplicate filenames at different indexes, direct host derivation, and invalid
  project URLs.
- [ ] Export the signature-byte count from `file-validation.ts` so browser and
  server checks use one value:

```typescript
export const FILE_SIGNATURE_BYTES = 16;
```

- [ ] Implement the pure contract. Paths must always have this shape:

```typescript
`${sessionId}/${index}-${sanitizeFileName(fileName)}`
```

- [ ] Mock `tus-js-client` and test the exact adapter options:

```typescript
expect(Upload).toHaveBeenCalledWith(
  file,
  expect.objectContaining({
    endpoint: "https://abc.storage.supabase.co/storage/v1/upload/resumable",
    chunkSize: 6 * 1024 * 1024,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    headers: { "x-signature": "signed-token" },
    metadata: {
      bucketName: "enquiry-attachments",
      objectName: "session/0-brief.pdf",
      contentType: "application/pdf",
      cacheControl: "3600",
    },
  }),
);
```

- [ ] The adapter calls `findPreviousUploads()`, resumes the first matching
  upload when present, exposes progress through a callback, and returns a small
  handle whose `done` promise settles exactly once and whose `abort()` method
  cancels the live `Upload` instance.
- [ ] Omit `x-upsert`; do not overwrite a path. Use
  `removeFingerprintOnSuccess: true` so a completed path cannot be resumed into
  accidentally.
- [ ] Run the full gate suite.
- [ ] Stage the six named files and commit:

```text
feat: add resumable upload contract
```

---

## Task 4: Additive upload-session database foundation

**Files:**

- Create with `supabase migration new`:
  `supabase/migrations/<generated>_enquiry_upload_sessions.sql`

**Live project facts already verified read-only:** `pg_cron` 1.6.4, `pg_net`
0.20.3, Vault 0.3.1, and `pgcrypto` 1.3 are installed; no Cron jobs or Vault
secrets currently exist; the live project has zero enquiries and zero enquiry
attachments.

**Interfaces produced:** service-role-only RPCs
`create_enquiry_upload_session`, `get_enquiry_upload_session`,
`mark_enquiry_upload_session_failed`, `list_expired_enquiry_upload_sessions`,
`mark_enquiry_upload_session_expired`, and
`finalize_enquiry_upload_session`.

- [ ] Discover the CLI command before using it. The CLI is not installed
  globally, so use a transient current stable CLI and do not add it to app
  dependencies:

```powershell
pnpm dlx supabase@latest migration new --help
pnpm dlx supabase@latest migration new enquiry_upload_sessions
```

- [ ] Put the following complete schema in the generated migration file:

```sql
create table public.enquiry_upload_sessions (
  id uuid primary key,
  ip_hash text not null check (length(ip_hash) = 64),
  client_secret_hash text not null check (length(client_secret_hash) = 64),
  status text not null default 'pending'
    check (status in ('pending', 'finalizing', 'completed', 'failed', 'expired')),
  file_manifest jsonb not null default '[]'::jsonb
    check (jsonb_typeof(file_manifest) = 'array')
    check (jsonb_array_length(file_manifest) <= 5),
  enquiry_id uuid unique references public.enquiries (id) on delete set null,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.enquiry_upload_sessions
  for each row execute function public.set_updated_at();

create index enquiry_upload_sessions_rate_limit_idx
  on public.enquiry_upload_sessions (ip_hash, created_at desc);
create index enquiry_upload_sessions_cleanup_idx
  on public.enquiry_upload_sessions (expires_at)
  where status in ('pending', 'failed');

alter table public.enquiry_upload_sessions enable row level security;
revoke all on public.enquiry_upload_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.enquiry_upload_sessions to service_role;

create or replace function public.create_enquiry_upload_session(
  p_session_id uuid,
  p_ip_hash text,
  p_client_secret_hash text,
  p_file_manifest jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry jsonb;
begin
  if length(p_ip_hash) <> 64 or length(p_client_secret_hash) <> 64 then
    raise exception using errcode = '22023', message = 'invalid_upload_session_hash';
  end if;
  if jsonb_typeof(p_file_manifest) <> 'array'
     or jsonb_array_length(p_file_manifest) > 5 then
    raise exception using errcode = '22023', message = 'invalid_upload_manifest';
  end if;

  for entry in select value from jsonb_array_elements(p_file_manifest)
  loop
    if coalesce(entry ->> 'storage_path', '') = ''
       or not starts_with(entry ->> 'storage_path', p_session_id::text || '/')
       or coalesce(entry ->> 'file_name', '') = ''
       or coalesce(entry ->> 'mime_type', '') = ''
       or coalesce((entry ->> 'size_bytes')::bigint, 0) <= 0
       or (entry ->> 'size_bytes')::bigint > 15728640 then
      raise exception using errcode = '22023', message = 'invalid_upload_manifest';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  if (
    select count(*)
    from public.enquiry_upload_sessions s
    where s.ip_hash = p_ip_hash
      and s.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'upload_rate_limit_exceeded';
  end if;

  insert into public.enquiry_upload_sessions (
    id, ip_hash, client_secret_hash, file_manifest, expires_at
  ) values (
    p_session_id, p_ip_hash, p_client_secret_hash,
    p_file_manifest, now() + interval '24 hours'
  );
  return p_session_id;
end;
$$;

create or replace function public.get_enquiry_upload_session(p_session_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'client_secret_hash', s.client_secret_hash,
    'status', s.status,
    'file_manifest', s.file_manifest,
    'enquiry_id', s.enquiry_id,
    'expires_at', s.expires_at
  )
  from public.enquiry_upload_sessions s
  where s.id = p_session_id;
$$;

create or replace function public.mark_enquiry_upload_session_failed(p_session_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.enquiry_upload_sessions
  set status = 'failed'
  where id = p_session_id and status in ('pending', 'finalizing');
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.list_expired_enquiry_upload_sessions(
  p_limit integer default 50
)
returns table (id uuid, file_manifest jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.file_manifest
  from public.enquiry_upload_sessions s
  where s.status in ('pending', 'failed')
    and s.expires_at <= now()
  order by s.expires_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.mark_enquiry_upload_session_expired(p_session_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.enquiry_upload_sessions
  set status = 'expired'
  where id = p_session_id
    and status in ('pending', 'failed')
    and expires_at <= now();
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.finalize_enquiry_upload_session(
  p_session_id uuid,
  p_full_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_project_type text,
  p_location text,
  p_timeline text,
  p_description text,
  p_budget text,
  p_client_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_row public.enquiry_upload_sessions%rowtype;
  new_enquiry_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  select * into session_row
  from public.enquiry_upload_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'upload_session_not_found';
  end if;
  if session_row.status = 'completed' then
    return jsonb_build_object(
      'enquiry_id', session_row.enquiry_id,
      'created', false
    );
  end if;
  if session_row.status not in ('pending', 'finalizing') then
    raise exception using errcode = 'P0001', message = 'upload_session_not_finalizable';
  end if;
  if session_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'upload_session_expired';
  end if;

  update public.enquiry_upload_sessions
  set status = 'finalizing'
  where id = p_session_id;

  new_enquiry_id := public.submit_enquiry(
    p_full_name, p_company, p_email, p_phone, p_project_type,
    p_location, p_timeline, p_description, p_budget, p_client_notes,
    session_row.file_manifest
  );

  expected_count := jsonb_array_length(session_row.file_manifest);
  select count(*) into inserted_count
  from public.enquiry_attachments a
  where a.enquiry_id = new_enquiry_id;

  if inserted_count <> expected_count then
    raise exception using errcode = 'P0001', message = 'attachment_manifest_mismatch';
  end if;

  update public.enquiry_upload_sessions
  set status = 'completed', enquiry_id = new_enquiry_id,
      finalized_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'enquiry_id', new_enquiry_id,
    'created', true
  );
end;
$$;

revoke all on function public.create_enquiry_upload_session(uuid, text, text, jsonb)
  from public;
revoke all on function public.get_enquiry_upload_session(uuid) from public;
revoke all on function public.mark_enquiry_upload_session_failed(uuid) from public;
revoke all on function public.list_expired_enquiry_upload_sessions(integer) from public;
revoke all on function public.mark_enquiry_upload_session_expired(uuid) from public;
revoke all on function public.finalize_enquiry_upload_session(
  uuid, text, text, text, text, text, text, text, text, text, text
) from public;

grant execute on function public.create_enquiry_upload_session(uuid, text, text, jsonb)
  to service_role;
grant execute on function public.get_enquiry_upload_session(uuid) to service_role;
grant execute on function public.mark_enquiry_upload_session_failed(uuid) to service_role;
grant execute on function public.list_expired_enquiry_upload_sessions(integer)
  to service_role;
grant execute on function public.mark_enquiry_upload_session_expired(uuid)
  to service_role;
grant execute on function public.finalize_enquiry_upload_session(
  uuid, text, text, text, text, text, text, text, text, text, text
) to service_role;
```

- [ ] Self-review the exact generated signature with `pg_get_function_identity_arguments`;
  correct any mismatch before applying grants.
- [ ] Before applying, run the migration SQL inside `begin; ... rollback;` on
  the live project with `execute_sql`. Confirm the schema compiles and no
  object remains afterward.
- [ ] Apply the reviewed additive migration to project
  `tscaluhtfrvwlwjybfsg` using the Supabase migration tool.
- [ ] Run rolled-back verification that:
  - service role can create three sessions for one hash and the fourth raises
    `upload_rate_limit_exceeded`;
  - a different hash is allowed;
  - `anon` and ordinary `authenticated` roles see zero rows and cannot insert;
  - a zero-file session can finalize twice and returns the same enquiry id;
  - the transaction contains one enquiry and one client before rollback; and
  - all test rows are absent after rollback.
- [ ] Run Supabase security and performance advisors; fix new findings before
  moving on, and link any unresolved advisory in the final report.
- [ ] Run the full gate suite.
- [ ] Stage only the generated migration and commit:

```text
db: add enquiry upload sessions
```

---

## Task 5: Add preparation and finalization server services

**Files:**

- Create: `src/features/start-a-project/session-security.ts`
- Create: `src/features/start-a-project/session-security.test.ts`
- Create: `src/features/start-a-project/storage-verification.ts`
- Create: `src/features/start-a-project/storage-verification.test.ts`
- Modify: `src/features/start-a-project/actions.ts`
- Modify: `src/features/start-a-project/actions.test.ts`

**Important sequencing:** Keep the existing `submitProjectEnquiry()` export and
its tests in this task. The current form still imports it. Task 6 switches the
form and removes the legacy action in the same commit, so every intermediate
commit typechecks and builds.

**Interfaces produced:**

```typescript
export async function prepareProjectEnquiry(
  formData: FormData,
  descriptors: UploadDescriptor[],
): Promise<PrepareEnquiryResult>;

export async function finalizeProjectEnquiry(
  formData: FormData,
  sessionId: string,
  sessionSecret: string,
): Promise<FinalizeEnquiryResult>;
```

- [ ] Implement and test pure security helpers using `node:crypto`:

```typescript
export function createSessionSecret(): string;
export function sha256(value: string): string;
export function hashRequestAddress(address: string, secret: string): string;
export function secretsMatch(candidate: string, expectedHash: string): boolean;
export function requestAddress(headers: Headers): string;
```

`requestAddress` uses the first trimmed value from `x-vercel-forwarded-for`,
then `x-forwarded-for`, then `"local-development"`. `hashRequestAddress` uses
HMAC-SHA-256 with `ENQUIRY_UPLOAD_RATE_LIMIT_SECRET`; `secretsMatch` hashes the
high-entropy capability and compares equal-length buffers with
`timingSafeEqual`.

- [ ] Implement Storage verification with a service client and a cancelable
  prefix read:
  1. call `storage.from(BUCKET).info(path)`;
  2. compare exact size and content type to the manifest;
  3. fetch
     `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${encodedPath}`
     with service-role `apikey`, `Authorization`, and `Range: bytes=0-15`;
  4. read only `FILE_SIGNATURE_BYTES`, cancel the stream, and run
     `checkFileContent`;
  5. return a typed failure without logging names or paths.

- [ ] Implement `cleanupSessionObjects(manifest)` with
  `storage.from(BUCKET).remove(paths)`. It accepts paths only from the stored
  server manifest, never from request input.

- [ ] Implement `prepareProjectEnquiry`:
  - parse text fields through `projectEnquirySchema`;
  - return decoy `accepted` for a honeypot hit;
  - validate count and every descriptor against extension, exact size, and
    canonical MIME type;
  - generate session id and capability, build the normalized manifest, derive
    the keyed IP hash, and call `create_enquiry_upload_session`;
  - map `upload_rate_limit_exceeded` to the specific visitor message;
  - mint `createSignedUploadUrl(path, { upsert: false })` for every manifest
    entry;
  - if token creation fails, mark the session failed and return a generic
    failure; and
  - return only the session id, plain capability, and signed path tokens.

- [ ] Implement `finalizeProjectEnquiry`:
  - validate the UUID, capability shape, and form again;
  - load the session through `get_enquiry_upload_session`;
  - constant-time verify the capability hash;
  - return success immediately for a completed session;
  - reject expired/failed sessions with specific copy;
  - verify every stored object before calling the database finalizer;
  - on invalid/missing object, mark failed and best-effort remove all session
    objects;
  - call `finalize_enquiry_upload_session` with text fields only;
  - if the RPC response is ambiguous, reload the session and treat a completed
    row as success before attempting cleanup;
  - use the finalizer RPC's `{ enquiry_id, created }` result and insert the
    linked `ops_activity_log` row best-effort only when `created` is true; and
  - never log PII, capabilities, tokens, raw addresses, or paths.

- [ ] Expand action tests to cover: zero files, five files, bad descriptor,
  honeypot, rate limit, token failure, wrong capability, expired session,
  missing object, size mismatch, MIME mismatch, signature mismatch, finalizer
  RPC failure, ambiguous committed success, idempotent completed session,
  concurrent finalization without duplicate activity, and activity-log linkage.
- [ ] Assert in tests that neither action receives or forwards `File` objects.
- [ ] Run the full gate suite.
- [ ] Stage the six named files and commit:

```text
feat: prepare and finalize enquiry uploads
```

---

## Task 6: Switch the public form to direct resumable uploads

**Files:**

- Modify:
  `src/features/start-a-project/components/start-a-project-form.tsx`
- Modify: `src/features/start-a-project/start-a-project-form.test.tsx`
- Modify: `src/features/start-a-project/actions.ts`
- Modify: `src/features/start-a-project/actions.test.ts`
- Modify: `src/styles/public/overrides.css`
- Modify: `next.config.ts`

**Interfaces consumed:** `prepareProjectEnquiry`, `finalizeProjectEnquiry`,
  `descriptorForFile`, `startTusUpload`, and the existing file validators.

- [ ] Replace the single `sending` state with explicit stages:

```typescript
type FormStage = "idle" | "preparing" | "uploading" | "finalizing" | "sent" | "failed";
type FileStage = "waiting" | "uploading" | "uploaded" | "failed";

type SelectedFile = {
  id: string;
  file: File;
  stage: FileStage;
  progress: number;
  error?: string;
};
```

- [ ] Make file selection asynchronous and run both `checkFileMeta` and
  `checkFileContent(await file.slice(0, FILE_SIGNATURE_BYTES).arrayBuffer())`
  before adding a file.
- [ ] On submit, construct text-only `FormData` explicitly rather than from the
  form element with file inputs. Pass descriptors separately. Add a test that
  every `FormData` value reaching either action is a string.
- [ ] After preparation, start the TUS uploads with stable index-to-file
  mapping. Update each row's percentage without changing row dimensions. Keep
  completed rows intact when another file fails.
- [ ] Store failed upload handles/session data in refs. An inline `Retry` button
  retries only that file and resumes its TUS fingerprint. When all rows are
  uploaded, finalization proceeds automatically.
- [ ] Abort active TUS uploads on unmount. Removing files is available only
  before preparation begins; all selection controls are disabled once a session
  exists.
- [ ] Render accessible status text (`aria-live="polite"`) and an inline
  `<progress>` element or equivalent native progress semantics for each active
  file. The visible states are `Waiting`, `N%`, `Uploaded`, and `Failed`.
- [ ] Keep button copy stage-specific: `Preparing...`, `Uploading...`,
  `Finishing...`, otherwise `Send project details`.
- [ ] Test no-file success, per-file progress, one-file retry, completed-file
  preservation, finalization error, no duplicate submit while active, magic-byte
  rejection at selection, and upload abort on unmount.
- [ ] Remove the legacy `submitProjectEnquiry()` implementation and its obsolete
  tests only after the form no longer imports it.
- [ ] Remove `experimental.serverActions.bodySizeLimit` and its comment from
  `next.config.ts`; the default limit is now sufficient because actions carry
  text/metadata only.
- [ ] Extend `overrides.css` with restrained, fixed-layout status/progress/retry
  styles using existing CSS variables. Do not add cards, gradients, or new
  colors.
- [ ] Run the full gate suite.
- [ ] Stage the six named files and commit:

```text
feat: upload enquiry attachments directly
```

---

## Task 7: Add abandoned-upload cleanup and schedule it

**Files:**

- Create: `supabase/functions/cleanup-enquiry-upload-sessions/index.ts`
- Create with `supabase migration new`:
  `supabase/migrations/<generated>_schedule_enquiry_upload_cleanup.sql`

- [ ] Implement the Edge Function with no caller-supplied paths:

```typescript
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const BUCKET = "enquiry-attachments";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Not configured", { status: 500 });
  if (request.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessions, error } = await supabase.rpc(
    "list_expired_enquiry_upload_sessions",
    { p_limit: 50 },
  );
  if (error) throw error;

  let cleaned = 0;
  let failed = 0;
  for (const session of sessions ?? []) {
    const paths = Array.isArray(session.file_manifest)
      ? session.file_manifest
          .map((entry: unknown) =>
            typeof entry === "object" && entry && "storage_path" in entry
              ? String((entry as Record<string, unknown>).storage_path)
              : "",
          )
          .filter(Boolean)
      : [];
    const removeResult = paths.length
      ? await supabase.storage.from(BUCKET).remove(paths)
      : { error: null };
    if (removeResult.error) {
      failed += 1;
      console.error("cleanup-enquiry-upload-sessions: remove failed", session.id);
      continue;
    }
    const mark = await supabase.rpc("mark_enquiry_upload_session_expired", {
      p_session_id: session.id,
    });
    if (mark.error || mark.data !== true) {
      failed += 1;
      console.error("cleanup-enquiry-upload-sessions: mark failed", session.id);
      continue;
    }
    cleaned += 1;
  }

  return Response.json({ scanned: sessions?.length ?? 0, cleaned, failed });
});
```

- [ ] Keep `verify_jwt: true` when deploying. The function also compares the
  Authorization bearer value to its built-in service-role key, so an anon JWT
  cannot invoke privileged cleanup.
- [ ] Deploy the function to `tscaluhtfrvwlwjybfsg` with the Supabase Edge
  Function tool. Confirm a service-authorized empty run returns
  `{ scanned: 0, cleaned: 0, failed: 0 }` before scheduling.
- [ ] Pause for the owner to create two Vault secrets in the Supabase dashboard;
  never ask them to paste either value into chat:
  - `enquiry_cleanup_project_url` = the project URL;
  - `enquiry_cleanup_service_role_key` = the service-role key.
- [ ] Create the scheduling migration using the CLI command discovered in Task
  4. It contains names only, never values:

```sql
select cron.schedule(
  'cleanup-enquiry-upload-sessions',
  '17 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'enquiry_cleanup_project_url'
      ) || '/functions/v1/cleanup-enquiry-upload-sessions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'enquiry_cleanup_service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
```

- [ ] Verify both expected Vault names exist without selecting decrypted values.
- [ ] Verify the migration in a rolled-back transaction, then apply it.
- [ ] Assert exactly one active Cron row exists with this job name. Invoke it
  once, then inspect `cron.job_run_details` and `net._http_response` for a 2xx
  response. Do not create stale live objects for this test without a separate
  explicit approval.
- [ ] Run Supabase advisors again.
- [ ] Run the full gate suite.
- [ ] Stage only the function and generated migration, then commit:

```text
feat: clean abandoned enquiry uploads
```

---

## Task 8: Prepare deferred permission narrowing

**Files:**

- Create:
  `supabase/deferred/20260928_restrict_enquiry_upload_entrypoints.sql`

**Do not apply this file while `main` still serves code that relies on direct
anon upload or direct `submit_enquiry()` execution.** It is a cutover artifact,
not an ordinary migration.

- [ ] Add the deferred SQL with rollback instructions in its header:

```sql
-- DEFERRED: apply only after the signed-upload production code is live.
-- Rollback: recreate enquiry_attachments_anon_upload exactly as recorded in
-- 20260927_enquiries_and_attachments.sql, then grant submit_enquiry execute to
-- anon and authenticated.

begin;

drop policy if exists enquiry_attachments_anon_upload on storage.objects;

revoke execute on function public.submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from anon, authenticated;

commit;
```

- [ ] Verify syntax and resulting privileges inside a transaction that always
  rolls back. Explicitly assert:
  - direct anon Storage insert is rejected after the temporary drop;
  - `has_function_privilege('anon', ..., 'EXECUTE')` and the authenticated
    equivalent are false;
  - service-role finalization still has the required execution path; and
  - after rollback, the current live anon policy and grants are still present.
- [ ] Do not apply the deferred file in this sub-project unless the user
  separately authorizes production cutover.
- [ ] Run the full gate suite.
- [ ] Stage only the deferred SQL and commit:

```text
security: prepare enquiry upload cutover
```

---

## Task 9: Configure preview and run deployed upload verification

**No repository files are changed until verification findings require a fix.**

- [ ] Pause for the owner to set these values in local `.env.local` and Vercel
  Preview/Production settings; do not ask them to send secret values in chat:
  - `SUPABASE_SERVICE_ROLE_KEY`;
  - `ENQUIRY_UPLOAD_RATE_LIMIT_SECRET` (at least 32 random bytes).
- [ ] Push `next-migration` so Vercel creates a preview deployment. Do not merge
  and do not open a PR.
- [ ] Confirm browser network traffic shows:
  - text/metadata-only requests to the Next.js origin;
  - file bytes sent only to the direct Supabase Storage hostname; and
  - TUS chunks no larger than 6 MB.
- [ ] Ask for explicit approval immediately before writing throwaway data to the
  live Supabase project.
- [ ] After approval, submit one valid file larger than 4.5 MB, verify the
  enquiry, attachment metadata, Storage object, activity row, and per-file UI,
  then delete the enquiry, attachment, client (only if created solely for the
  test), upload session, activity row, and Storage object.
- [ ] Run an interrupted/resumed upload and retry one failed file. Clean every
  resulting session/object afterward.
- [ ] Test an invalid-signature object through the lowest safe level that proves
  authoritative rejection; assert no enquiry/attachment row exists and cleanup
  removed every object. Clean any remaining session.
- [ ] If preview protection blocks automation, use the documented Vercel
  protection-bypass mechanism or have the owner open the preview; never disable
  production protection casually.
- [ ] Run the full gate suite after any fix arising from deployed verification.
- [ ] Commit any named fix files separately with a focused message.

---

## Task 10: Whole-sub-project review and architecture record

**Files:**

- Modify: `docs/architecture/application-architecture.md`
- Modify only if findings require it: approved spec/plan and implementation
  files from Tasks 2-9.

- [ ] Compare the finished branch line-by-line against the approved design spec,
  especially all-or-nothing behavior, idempotency, retries, cleanup, and the
  deferred cutover boundary.
- [ ] Search for forbidden paths and leakage:

```powershell
rg -n "submitProjectEnquiry|bodySizeLimit|enquiry_attachments_anon_upload|SUPABASE_SERVICE_ROLE_KEY|ENQUIRY_UPLOAD_RATE_LIMIT_SECRET" src next.config.ts supabase docs
```

Expected:

- no legacy `submitProjectEnquiry` call remains;
- no raised Server Action body limit remains;
- service secrets appear only in server-only code, `.env.example`, docs, and
  Edge Function environment reads;
- the anon upload policy appears only in its historical migration and deferred
  removal/rollback text.

- [ ] Inspect the client bundle output or Next build traces to confirm
  `server-env.ts`, `db/service.ts`, and service credentials are absent.
- [ ] Re-run database permission checks with explicit counts and run both
  Supabase advisor categories.
- [ ] Add “Phase 5, sub-project 3 — Signed resumable enquiry uploads” to the
  architecture document, recording:
  - the Vercel 4.5 MB root cause and direct-upload resolution;
  - TUS/token/session/finalization architecture;
  - rate limit and cleanup schedule;
  - required Vercel and Vault configuration;
  - deployed verification actually completed versus skipped;
  - any residual orphan, abuse, or operational risk;
  - the deferred policy/grant removal and exact cutover condition; and
  - that the separate live OPS smoke test still needs an admin login.
- [ ] Run the full gate suite one final time.
- [ ] Stage the architecture file and any explicitly reviewed correction files
  by name, then commit:

```text
docs: record signed enquiry upload architecture
```

- [ ] Confirm `git status --short` contains only the unrelated files listed in
  the handoff.
- [ ] Push `next-migration` to `origin`. Do not merge and do not open a PR.

## Final completion conditions

This sub-project is complete only when:

- every task's full gate suite is green;
- the additive session migration is applied and verified;
- the cleanup function is deployed and its Cron job has a successful run;
- a deployed preview proves attachment bytes bypass Vercel;
- all approved live test data and files are removed;
- the deferred narrowing migration remains unapplied unless production cutover
  was separately authorized;
- the finished implementation matches the approved design spec; and
- all commits are pushed to `origin/next-migration` with unrelated working files
  untouched.
