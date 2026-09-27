# Attachment Pipeline and Enquiry Record — Design

**Status:** approved by user in brainstorming session, 2026-09-27
**Governing specs:** `docs/LGNDRY_Website_Refinement_Scope.md` §11 (Start a Project), `docs/LGNDRY_Command_Center_Refinement_Scope.md` §05–06 (Enquiry Record, Attachment System)

## Why this is the first sub-project

The Command Center refinement scope names the attachment pipeline as its highest
priority, and treats it as a complete pipeline problem, not a cosmetic one:

> FRONTEND FILE INPUT → HTTP REQUEST → multipart/form-data → BACKEND PARSING →
> VALIDATION → STORAGE → DATABASE/RECORD ASSOCIATION → ENQUIRY ID → COMMAND
> CENTER → FILE DISPLAY → SECURE ACCESS

An audit of the current site and database found that this pipeline does not
exist at all today (not "broken" — absent): no page has a file input, and no
table links an uploaded file to anything. Separately, the only files that exist
today (email attachments the studio has sent, including a signed model-release
form and a client rate card) live in the `media` Storage bucket, which is
public with no size or type limits and guessable URLs. Building the real
pipeline, on a private bucket, is this sub-project.

## Scope boundary (what this sub-project is, and is not)

**Is:**
- A new `enquiries` + `enquiry_attachments` data model.
- A private Storage bucket for enquiry attachments, with server-side validation.
- One new public page, `/start-a-project`, per the website scope's §11 field
  list — the only form in the new design that collects attachments.
- A bare, unstyled admin page proving an authenticated admin can list new
  enquiries and securely open their attachments.

**Is not** (explicitly deferred to later sub-projects):
- The styled Enquiries list + detail page matching `docs/design-references/enquiries.png`
  and `view-enquiry.png` (own sub-project, own design pass).
- Quotes, bookings, payments, communication history, follow-ups — these will
  reference `enquiries.id` when they are built, but no columns or tables for
  them are added now.
- Retiring the existing Contact page, Booking dialog, or Partnership dialog,
  and any website navigation/IA change (Work / Practice / Fine Art / About /
  Start a Project). Those keep working exactly as they do today, writing into
  `clients` / `bookings` / `partnerships` as before — a deliberate, temporary
  parallel path.
- Migrating existing `clients` / `bookings` / `partnerships` rows into
  `enquiries`. They stay exactly where they are, visible only in the current
  `admin.html`, until the full cutover.

## Attachment storage mechanism

Every write already migrated in this codebase (checkout, lead-capture, the
gallery-access fix) goes through Postgres row-level security as the
anonymous role — never a service-role key. This sub-project keeps that
property rather than introducing a new, more powerful credential:

- A new **private** Storage bucket, `enquiry-attachments`, with
  `file_size_limit` and `allowed_mime_types` set at the bucket level as a
  backstop.
- `anon` gets an **insert-only** policy on the bucket (same shape as
  `public_insert_lead` on `clients` today) — no read, update, or delete, so an
  uploaded file cannot be listed or fetched back by the public.
- The upload runs inside one Server Action (same shape as `submitBooking` /
  `placeOrder`): it validates the form with zod, then for each file checks its
  declared size against the cap, checks the extension against the allow-list,
  and **sniffs the first bytes against known file signatures** for its claimed
  type — because a browser's declared MIME type is trivially spoofable and the
  bucket-level check only looks at that declared header.
- Reading a file is `is_admin`-gated at the Storage-policy level (same shape as
  the existing `media_admin_*` policies). An admin's own signed-in session can
  then request a short-lived signed URL directly — no service-role key
  anywhere in this flow.
- Writing the *rows* (matching or creating the client, inserting the enquiry,
  inserting the attachment records) happens inside one new `SECURITY DEFINER`
  function, `submit_enquiry(...)` — not through direct anon INSERT policies on
  `clients`/`enquiries`/`enquiry_attachments`. This matters because matching an
  enquiry to an existing client by email requires *reading* `clients` first,
  and `anon` has no read access there (only the insert-only lead policy added
  earlier this project) — nor should it: a public SELECT policy would expose
  every client's name, email and phone to anyone with the anon key. The
  function does that lookup internally (same shape as `gallery_access` /
  `gallery_mark`), returns only the new enquiry id, and forces `status='New'`,
  `archived=false` regardless of what it's called with. `anon` and
  `authenticated` get `EXECUTE` on the function; nothing more.

**Known implementation risk, to verify early:** routing file bytes through a
Server Action for the byte-sniff means raising `next.config.ts`'s
server-action body-size limit, and Vercel's platform may cap request bodies
below what 5 × 15 MB needs. If that turns out to be a hard limit, the fallback
is a short-lived signed upload URL straight from the browser to Storage (still
bucket-limited, still anon-scoped), with the byte-sniff done as a follow-up
check rather than a blocking one. Either way, the limits and allowed types are
enforced; only which request carries the bytes changes.

## Data model

Two new tables. The existing `clients` table is reused for the client
relationship (per the Command Center scope's "reusable across projects,
without creating duplicate records") rather than inventing a second client
concept.

### `enquiries`

The submission "as told to us," plus its pipeline status.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, pk | |
| `client_id` | uuid → `clients.id` | see client matching, below |
| `full_name` | text | as submitted |
| `company` | text, nullable | |
| `email` | text | |
| `phone` | text | |
| `project_type` | text | one of: Documentary, Event, Film, Visual Production, Other |
| `location` | text | |
| `timeline` | text | free text ("Timeline / project date" per spec — not a strict date field) |
| `description` | text | |
| `budget` | text, nullable | optional per spec |
| `status` | text | New, Reviewing, Quoted, Follow-up, Booked, In Production, Completed, Closed — the Command Center scope's exact 8-stage pipeline, set in full now so later sub-projects need no migration, even though only "New" is reachable from this one |
| `source` | text, default `'Website'` | |
| `archived` | boolean, default `false` | |
| `created_at`, `updated_at` | timestamptz | |

### `enquiry_attachments`

One row per uploaded file.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, pk | |
| `enquiry_id` | uuid → `enquiries.id`, cascade delete | |
| `storage_path` | text | path inside the `enquiry-attachments` bucket |
| `file_name` | text | original filename as uploaded |
| `mime_type` | text | |
| `size_bytes` | integer | |
| `created_at` | timestamptz | |

### Client matching

Inside `submit_enquiry`: look up an existing, non-archived client by email
(case-insensitive). If found, link the new enquiry to it. Otherwise create a
new `clients` row (status `Lead`, Company vs. Individual by whether a company
name was given) — reusing the existing `leadClientRow` logic already used by
the current lead-capture code. No fuzzy matching, no merge UI: that is CRM
work for a later pass.

### Access

No direct table policies for `anon` on `clients` (unchanged), `enquiries`, or
`enquiry_attachments` — all public writes go through `submit_enquiry`, as
described above. `is_admin` gets full `SELECT`/etc. access to both new tables,
same shape as every other admin-only table in this project. Uploaded files
themselves reach Storage directly from the Server Action against the
insert-only bucket policy (not through this function — see above), and
`submit_enquiry` is given each file's already-uploaded storage path, name,
MIME type and size to record.

## Validation and limits

- **Allowed types:** PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX (the website
  scope's exact list).
- **Limits:** 15 MB per file, up to 5 files per submission.
- Checked twice: immediately in the browser (fast, specific feedback — e.g.
  "Location_References.zip is 22 MB — the limit is 15 MB per file"), and
  authoritatively again on the server (size, extension, and the magic-byte
  sniff described above).

## The public form

A new, working page at `/start-a-project`. Nothing links to it yet — nav and
CTA wiring is the later website-structure sub-project — but it is a real,
reachable URL from day one.

Fields: Name\*, Company, Email\*, Phone\*, Project type\* (select: Documentary
/ Event / Film / Visual Production / Other), Location\*, Timeline\*, Project
description\* (textarea), Budget (optional, free text — deliberately not a
structured picker, matching the scope's "don't make them write a perfect
brief" principle), File attachments (multi-file, drag-or-click), and the same
honeypot field the existing forms use.

Server action returns the existing `{ ok: true } | { ok: false, error }`
shape used by lead-capture/checkout, except file errors are surfaced
per-file rather than as one generic failure.

## Admin verification surface

A bare page at `/ops/enquiries` (under the existing `(app)` layout, which
already gates `/ops/*` behind sign-in). A single unstyled table: name/company,
email, project type, status, submitted date, and an Attachments column listing
each file name as a link that requests a signed URL and opens it. No search,
filters, tabs, or cross-linked right rail — that is the next sub-project,
matching `docs/design-references/enquiries.png` and `view-enquiry.png`
exactly.

## Testing plan

- Unit tests: the zod schema, per-file validation (extension allow-list +
  magic-byte sniff per allowed type), client-matching logic, record shaping.
- Server-action tests with a mocked Supabase client: happy path with
  attachments, happy path with none, matched-existing-client vs.
  new-client-created, oversized file, disallowed extension, a file whose real
  bytes don't match its claimed type, honeypot hit, too many files, invalid
  fields.
- Database-level checks in a transaction that is rolled back (same method
  used for the RLS and gallery-access work earlier in this project): confirm
  `anon` can call `submit_enquiry` successfully but has no direct `SELECT` or
  `INSERT` on `clients`/`enquiries`/`enquiry_attachments`, can insert into the
  attachment bucket but not read or list it, and `is_admin` can read
  everything — before calling the migration done.
- One real end-to-end pass in the browser: submit the live form with a real
  small PDF and JPG, then confirm it as a signed-in admin at `/ops/enquiries`,
  including opening the file. This one step writes a real row to the live
  database — flagged again before it happens, with the test enquiry deleted
  afterward.
