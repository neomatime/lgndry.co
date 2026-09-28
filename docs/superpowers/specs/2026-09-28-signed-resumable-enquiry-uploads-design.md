# Signed Resumable Enquiry Uploads — Design

**Status:** approved by user, 2026-09-28  
**Governing specs:** `docs/LGNDRY_Website_Refinement_Scope.md` §11 (Start a
Project), `docs/LGNDRY_Command_Center_Refinement_Scope.md` §06 (Attachment
System)  
**Preceding work:**
`docs/superpowers/specs/2026-09-27-attachment-pipeline-and-enquiry-record-design.md`

## Approved implementation deviation — 2026-09-28

This section is authoritative where it differs from the original TUS design
below.

The production-preview test reached hosted Supabase Storage `1.77.5`, but
Storage rejected a correctly formed token created by its own signed resumable
upload endpoint with `Invalid Compact JWS` (`ERR_JWS_INVALID`). This matches the
open upstream Storage defect documented in
<https://github.com/supabase/storage/issues/1268>. The user approved a temporary
fallback to Supabase's standard path-scoped signed upload URL flow.

The browser therefore sends each file directly to the exact URL returned by
`createSignedUploadUrl()` using one multipart `PUT`. File bytes still never
cross Vercel, progress and cancellation remain visible, paths remain unique,
and finalization still performs the same authoritative Storage checks. A retry
restarts only the failed file from byte zero; completed files and the form state
are preserved. The fallback does not provide byte-range resume.

For this implementation, references below to TUS headers, 6 MB chunks, the
direct Storage hostname, resumable offsets, and `tus-js-client` are historical
design intent. Deployed verification must instead prove that a file larger than
Vercel's request limit travels in one direct signed Storage `PUT`, that an
interrupted upload can be retried without re-preparing the session, and that no
file bytes touch the Vercel origin. "Survive ordinary network interruption" in
the success criteria means recovery through this preserved-state retry flow,
not continuation from the last uploaded byte.

## Problem

The current `/start-a-project` action receives the complete `FormData`, including
every attachment, before uploading the files from the Vercel Function to
Supabase Storage. Next.js is configured with an 80 MB Server Action body limit,
but Vercel's platform request-size limit applies first and cannot be raised by
that setting. The current 15 MB-per-file, five-file contract can therefore fail
in production even though it passed against the local development server.

This sub-project removes file bytes from every Vercel request. The browser will
upload directly to the existing private `enquiry-attachments` bucket with
short-lived, path-specific signed tokens. A small Server Action will prepare the
upload session, and another will validate and finalize it after Storage confirms
all uploads.

## Scope

### Included

- Signed, direct browser-to-Supabase uploads using the TUS resumable protocol.
- A server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY` solely for
  privileged upload-session, validation, and cleanup operations.
- A private upload-session record that binds the expected files to random
  Storage paths and supports idempotent finalization.
- Invisible rate limiting: at most three newly prepared upload sessions per
  keyed IP hash in a rolling hour.
- Browser validation before upload and authoritative server validation after
  upload, including the existing magic-byte rules.
- All-or-nothing enquiry creation and best-effort cleanup on every detected
  failure.
- Automatic deletion of abandoned, unfinalized upload sessions and their files
  after 24 hours.
- Per-file upload progress, clear status text, and retry for failed uploads.
- Removal of the now-unnecessary broad anonymous Storage upload policy and the
  80 MB Server Action body-size override.
- Unit, integration-style, database-policy, browser, and production-preview
  verification appropriate to the new flow.

### Excluded

- Linking `/start-a-project` from the public navigation or calls to action.
- Changes to the accepted file types, 15 MB-per-file limit, or five-file limit.
- Changes to the styled Enquiries list/detail pages.
- Communication, follow-up, qualification, assignment, quote, booking, payment,
  project, or client write workflows.
- The separate live-data OPS smoke test. That follows this sub-project and still
  requires an administrator login supplied or created by the owner.
- Retiring the legacy Contact, Booking, or Partnership forms.

## Upload flow

### 1. Local validation

The existing client-side checks remain the first feedback layer:

- form-required fields and zod-compatible value limits;
- at most five files;
- allowed extension;
- non-empty file no larger than 15 MB; and
- magic-byte family check using the first 16 bytes.

The browser check improves feedback but is never treated as authoritative.

### 2. Prepare an upload session

The client calls a new Server Action with the form fields and file descriptors
only (`name`, `size`, and canonical MIME type). No `File`, `Blob`, base64 data,
or multipart file body crosses Vercel.

The action:

1. validates the complete form, honeypot, file count, names, extensions, sizes,
   and canonical MIME types;
2. derives the request address from the trusted deployment proxy header and
   stores only an HMAC hash made with a server-only rate-limit secret;
3. atomically enforces the three-sessions-per-hour limit;
4. creates a private pending upload-session row with a random id, a separately
   generated client finalization capability-secret hash, a normalized file
   manifest, and a 24-hour expiry;
5. assigns each file a non-guessable path below that session's prefix; and
6. uses the server-only Supabase client to create one signed upload token per
   path.

Supabase signed upload tokens expire after two hours. They authorize upload to
only the generated object path and do not permit listing or reading the private
bucket. The service-role key never appears in a Client Component, serialized
action response, log message, or error response.

A honeypot hit returns a decoy accepted result without creating a session or
issuing tokens.

### 3. Direct resumable upload

The browser uploads each file to Supabase's direct Storage hostname with
`tus-js-client`, using:

- the signed token in the `x-signature` header;
- the existing private bucket name and server-assigned object path;
- the canonical MIME type, not the browser-declared type;
- a 6 MB TUS chunk size, as required by Supabase;
- bounded retries for transient network errors; and
- no upsert, because every path is unique and must be written once.

The file list exposes each file's state: `Waiting`, percentage progress,
`Uploaded`, or `Failed`. A failed file can be retried without clearing form
fields or restarting completed files. The primary button reflects the overall
stage and remains disabled during preparation, upload, and finalization.

### 4. Authoritative finalization

After every upload reports success, the client calls a finalization Server
Action with the small form payload, upload-session id, and client capability
secret. It does not resend any file bytes. The high-entropy secret remains valid
for retries of that session but is stored only as a hash and expires with the
session.

The finalizer authenticates the session capability, then verifies every manifest
entry against the stored object:

- the object exists at the exact server-assigned bucket path;
- the stored byte size equals the declared and expected size;
- the stored MIME type equals the canonical type for the extension;
- the file remains within the bucket limit; and
- the first bytes match the existing PDF, JPEG, PNG, OLE, or ZIP-office
  signature rule.

Signature inspection reads only the beginning of the object and cancels the
response stream after enough bytes are available. It must not buffer a complete
15 MB file in the Vercel Function. The implementation will be verified against
the deployed Supabase Storage behavior before it is treated as complete.

Only after every file passes does finalization call one database function that
locks the session row, creates or matches the client, creates the enquiry,
creates every attachment row, and marks the session completed with the resulting
enquiry id in the same transaction. The function may reuse the existing
`submit_enquiry()` implementation internally, but it must assert that the number
of attachment rows written equals the session manifest before committing. The
activity-log insert remains best-effort after the enquiry transaction, matching
current behavior.

Finalization is idempotent. The database function returns the existing enquiry
id when the locked session is already complete, so duplicate clicks, concurrent
requests, and a retry after an ambiguous network response cannot write a second
enquiry.

## Failure and cleanup behavior

The rule is all-or-nothing from the visitor's perspective:

- A preparation failure creates no session and uploads nothing.
- An upload failure creates no enquiry. Completed files remain available for
  retry during the session.
- A missing, mismatched, oversized, or invalid-signature object causes
  finalization to fail, creates no enquiry, and deletes all completed objects
  under that session prefix.
- A confirmed database finalization failure creates no partial enquiry because
  session completion and enquiry creation share one transaction. After an
  ambiguous transport failure, the action first reads the session state: it
  returns success if the transaction committed and only starts cleanup if the
  session is still unfinalized.
- Cleanup failures are logged with the session id but never leak object paths,
  tokens, secrets, or client details to the visitor.

An hourly Supabase Cron job invokes a dedicated
`cleanup-enquiry-upload-sessions` Edge Function through `pg_net`. The Cron call
uses the project URL and service-role JWT stored in Supabase Vault; no secret is
written into a migration. The Edge Function finds pending or failed sessions
whose 24-hour expiry has passed, removes every Storage object under the exact
session prefix through the Storage API, and only then marks the session expired.
It is safe to retry: a missing object is treated as already cleaned, and
completed sessions are never selected.

Keeping cleanup in a Supabase Edge Function avoids routing Storage housekeeping
through Vercel. The migration may enable `pg_cron` and `pg_net` additively, but
Vault secret creation, Edge Function deployment, and job activation are explicit
deployment steps and must be verified against the live project before the job is
considered active.

## Data model and database access

Add one private operational table, tentatively
`public.enquiry_upload_sessions`:

| Column | Purpose |
| --- | --- |
| `id` | Random UUID and Storage-prefix identity |
| `ip_hash` | HMAC of the request address for rolling rate limits; never the raw address |
| `client_secret_hash` | Hash of the finalization capability secret returned only to that browser |
| `status` | `pending`, `finalizing`, `completed`, `failed`, or `expired` |
| `file_manifest` | Server-normalized names, paths, canonical types, and expected sizes |
| `enquiry_id` | Resulting enquiry id after successful finalization |
| `expires_at` | Cleanup eligibility, 24 hours after creation |
| `created_at`, `updated_at`, `finalized_at` | Audit and idempotency timestamps |

RLS is enabled. `anon` and `authenticated` receive no direct table access. Any
database functions used for atomic rate limiting or state transitions are
explicitly revoked from `PUBLIC` and granted only to `service_role`; their
arguments and return values contain no service key or signed upload token.

The existing `submit_enquiry()` logic remains the basis of the single
client/enquiry/attachment transaction, but direct execution by `anon` or
ordinary `authenticated` users must be revoked after the compatible production
code is live. Otherwise a caller could bypass the preparation rate limit and
authoritative finalizer by invoking the RPC directly. The new finalization
function is explicitly revoked from `PUBLIC` and executable only by
`service_role`. Any permission narrowing that could affect deployed code remains
in a deferred migration until cutover.

## Storage access changes

The bucket remains private with the existing file-size and MIME-type limits.

The permission-narrowing migration removes
`enquiry_attachments_anon_upload` and revokes direct `anon`/`authenticated`
execution of `submit_enquiry()`. After deployment, public visitors cannot upload
through an ordinary anon-key Storage request or create an enquiry outside the
rate-limited finalization path. They can upload only to a path covered by an
unexpired signed upload token. Authenticated administrators retain their
existing read policy and signed download flow.

Because dropping the anonymous policy narrows live permissions, deployment is
ordered:

1. add the session schema and deploy code/secrets/cleanup support;
2. verify signed uploads on the deployed preview;
3. deploy the compatible production code; and
4. only then apply the policy-removal migration.

If the branch is not yet serving production traffic, the permission-narrowing
migration stays deferred beside the existing deferred migrations until cutover.

## Server-only configuration

Add validated, lazily read server configuration for:

- `SUPABASE_SERVICE_ROLE_KEY`; and
- `ENQUIRY_UPLOAD_RATE_LIMIT_SECRET` (a separate high-entropy value used for
  keyed IP hashes and never reused as an API credential).

Both values are required in local development and in Vercel Preview/Production
before the new upload flow can prepare a session. They must not use a
`NEXT_PUBLIC_` prefix and must not be committed. The public URL and publishable
key remain the only Supabase values exposed to the browser.

## Error handling and observability

Visitors receive specific, actionable messages for validation, rate limiting,
upload interruption, expired sessions, and retryable finalization failures.
Internal errors remain generic.

Server logs use stable stage prefixes (`prepare`, `token`, `verify`, `finalize`,
`cleanup`) and include a session id for correlation. Logs exclude names, email
addresses, phone numbers, original signed tokens, the client secret, raw IP
addresses, and service credentials.

## Testing and verification

### Unit and component tests

- File-descriptor validation and server path construction.
- IP HMAC stability without exposing raw addresses.
- Upload-session response shaping and secret verification.
- TUS configuration: direct Storage hostname, 6 MB chunks, no upsert, signed
  token header, progress, retry, and cancellation cleanup.
- Form states for preparation, per-file progress, retry, finalization, success,
  rate limiting, expiration, and generic failure.
- Idempotent finalization and no duplicate enquiry on a repeated request.
- All-or-nothing behavior for missing, mismatched, oversized, and invalid files.
- Best-effort object cleanup after finalization failure.

### Database and policy checks

Run in rolled-back transactions where possible and assert row counts explicitly:

- three sessions per IP hash in an hour are allowed and the fourth is rejected;
- a different hash is unaffected;
- expired rows no longer count toward the rolling limit;
- `anon` and ordinary `authenticated` users cannot read or mutate upload
  sessions;
- only the intended privileged path can transition a session;
- duplicate finalization cannot create a second enquiry; and
- the final production policy state rejects direct anonymous bucket uploads
  while preserving administrator reads.

### Deployed upload checks

- Confirm no request to the Next/Vercel origin contains attachment bytes.
- Upload a valid file larger than Vercel's request limit through the deployed
  preview and observe TUS progress and successful finalization.
- Interrupt and resume an upload.
- Retry one failed file without restarting completed files.
- Confirm an invalid-signature object produces no enquiry or attachment rows and
  is removed.
- Confirm an expired unfinalized session and its objects are removed by cleanup.
- Run the full repository gate suite:
  `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

The deployed tests must not target the live project with throwaway rows or files
without explicit approval. Any approved test data is deleted afterward.

## Success criteria

- A 15 MB attachment and a five-file submission do not traverse or depend on
  Vercel's request-body limit.
- Uploads survive ordinary network interruption and visibly communicate
  progress.
- No enquiry is created unless every selected attachment passes authoritative
  validation and is recorded.
- Duplicate finalization cannot duplicate an enquiry.
- Anonymous visitors cannot upload arbitrary objects with the public key alone.
- Abandoned uploads are removed after 24 hours.
- Private attachments remain readable only by authorised administrators through
  short-lived signed download URLs.
- No service credential, raw IP address, upload token, finalization secret, or
  private object URL is exposed in logs or browser bundles.
