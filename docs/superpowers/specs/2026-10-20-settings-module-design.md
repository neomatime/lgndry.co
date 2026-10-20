# Settings Module Design

**Date:** 2026-10-20
**Status:** Implemented
**Branch:** `next-migration`

## Summary

Build the first complete Settings module for the OPS Command Center. The module stores the
single LGNDRY.Co workspace profile and the commercial defaults that the future Quotes and
Invoices module will copy into new records.

The initial release contains only settings backed by working data and write flows. It does not
show placeholder Team, Notifications, Billing, or Security controls from the reference mockup.
Resend credentials remain deployment secrets and are never stored in the application database.

## Goals

- Give administrators one reliable place to maintain LGNDRY.Co's business identity.
- Let the owner manually maintain the default terms copied into new quotes.
- Capture quote, retainer, deposit-due, banking, and email defaults before the commercial
  workflow is built.
- Protect commercially sensitive settings with admin-only reads and a controlled write RPC.
- Preserve an audit event for each settings update without logging banking values.
- Match the existing monochrome OPS interface and remain usable at desktop and mobile widths.

## Non-goals

- Team membership, invitations, roles, assignment, or workload settings.
- Notification rules or email automation controls.
- Storing Resend API keys or any other deployment credential.
- Uploading or replacing logos.
- Advanced security, sessions, two-factor authentication, or password controls.
- Quote generation, invoice generation, PDF creation, or email delivery.
- A general-purpose key/value settings system or multiple workspaces.

## Settings Record

The database contains exactly one `ops_settings` row with a stable UUID. It stores:

### General

- Workspace or business name.
- Company email.
- Company phone.
- Website URL.
- Business or physical address.
- Optional registration number.
- Fixed time zone: `Africa/Johannesburg`.
- Fixed currency: `ZAR`.
- A version number for optimistic locking.
- Created and updated timestamps and the last updating user.

### Quotes And Invoices

- Default quote terms, entered manually as plain text.
- Default booking-retainer percentage.
- Default quote-validity period in calendar days.
- Default deposit-invoice due period in calendar days.
- Bank name.
- Account holder.
- Account number.
- Branch code.
- Account type.
- Payment-reference instructions.
- Sender display name.
- Sender email.
- Reply-to email.

The migration seeds one safe record with `LGNDRY.Co`, `info@lgndry-co.co.za`, the public website,
Johannesburg time, ZAR, a 50% retainer, seven-day quote validity, and a three-day deposit due
period. Legal terms, address, registration number, phone, and bank fields start blank rather than
being guessed.

Blank commercial fields are allowed in Settings. The future Quotes and Invoices module must run a
commercial-readiness check and prevent a quote or invoice from being sent when required identity,
terms, or payment details are incomplete.

## Database Security And Write Boundary

Row Level Security is enabled on `ops_settings`.

- Only authenticated users whose profile has `is_admin = true` may select the row.
- No authenticated role receives direct insert, update, or delete access.
- Settings cannot be deleted or duplicated through the application.
- All updates go through `update_ops_settings`.

`update_ops_settings` is an admin-gated `SECURITY DEFINER` function with an empty pinned
`search_path`. It:

1. Confirms the caller is an authenticated administrator.
2. Validates the singleton record and expected version.
3. Rejects a stale version with a conflict result.
4. Validates fixed time-zone and currency values.
5. Updates all editable fields, increments the version, and records the updater.
6. Adds one activity event with collection `settings`, the singleton record ID, and action
   `updated`.
7. Returns the updated record and version.

Execute permission is revoked from `public`, `anon`, and `service_role` and granted only to
`authenticated`. The activity message identifies the updated section or field group but never
contains account numbers, branch codes, terms text, addresses, or other field values.

## Validation

The client and server share one Zod schema. The RPC repeats the security-critical and range checks.

- Workspace name and sender display name are required and length-limited.
- Company, sender, and reply-to emails must be valid addresses.
- Phone, address, registration number, bank fields, and terms are length-limited and may be blank.
- Website may be blank; when present it must be an `http` or `https` URL.
- Retainer percentage must be greater than zero and no more than 100.
- Quote-validity and deposit-due periods must be whole numbers from 1 through 365.
- Time zone and currency render as read-only values and cannot be changed from their approved
  constants.
- User-entered text is treated as plain text, not HTML.

## Page And Form

`/ops/settings` becomes an available sidebar destination. The page authenticates before fetching
data and displays the standard OPS page header:

- Title: **Settings**
- Description: **Manage workspace details and commercial defaults.**

The interface has two real tabs:

### General

- **Workspace Profile:** workspace name, company email, phone, website, address, and optional
  registration number.
- **Brand & Identity:** a read-only preview of the existing LGNDRY.Co logo plus the fixed time zone
  and currency.

### Quotes & Invoices

- **Quote Defaults:** manual terms, retainer percentage, validity days, and deposit due days.
- **Payment Details:** bank and payment-reference fields.
- **Email Identity:** sender name, sender email, and reply-to email. Supporting copy explains that
  the Resend API key is configured securely in Vercel, not on this page.

Tabs are real controls with keyboard support. The form uses established inputs, labels, inline
errors, Save Changes, and Discard Changes. Save is disabled while submitting. Unsaved values remain
visible after a validation or server error. A version conflict explains that another administrator
changed the settings and offers a clear way to load the current version.

The existing logo is presented as a brand reference only. There is no non-functional upload
button. Layout sections are unframed where practical, with restrained dividers and no nested
horizontal scrollbar.

## Data Fetching And Server Action

The server-only `fetchOpsSettings` function:

- Runs only after `requireOpsUser()`.
- Wraps Supabase access in `try/catch`.
- Logs unexpected failures with `console.error`.
- Returns `{ status: "ok", settings }` or `{ status: "error" }` and never throws.
- Asserts that exactly one settings row was returned so an RLS mismatch cannot masquerade as an
  empty workspace.

The page renders a distinct temporarily-unavailable `EmptyState` on a fetch failure. It never
renders a blank form with guessed defaults.

The settings server action calls `requireOpsUser()` before parsing or writing. It returns explicit
success, invalid, conflict, or error state, and revalidates `/ops/settings` after success.

## Commercial Snapshot Boundary

Settings are defaults, not mutable references for already-issued documents. The future commercial
module must copy business identity, terms, banking/payment instructions, email identity, and
applicable numeric defaults into each quote or invoice draft. Later Settings edits therefore affect
new drafts only and never silently change an approved quote or issued invoice.

Banking and terms remain admin-only in this module. Future public quote pages and generated PDFs
may receive only the specific immutable snapshot needed for that document through their dedicated
server-side flow.

## Testing

Automated coverage includes:

- Schema acceptance, normalization, bounds, and error messages.
- Pure mapping between database records and form values.
- Fetch success, query failure, thrown failure, and unexpected row count.
- Server action authentication, validation, RPC success, conflict, and failure.
- Page authentication order, success, and unavailable state.
- Form rendering, tab behavior, dirty/discard behavior, validation, saving, and conflict recovery.
- Migration assertions for the singleton constraint, RLS, grants, admin check, empty search path,
  optimistic locking, fixed values, version increment, and redacted activity entry.
- Sidebar availability and active state.

Before release, the SQL migration is run inside an always-rolled-back verification transaction with
row-count assertions for admin reads, non-admin reads, update success, stale-version rejection,
direct-write rejection, singleton enforcement, and activity logging. The live migration is applied
before code that reads `ops_settings` is pushed.

Every implementation task runs the full gate:

```text
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Release And Manual Verification

After deployment, an authenticated administrator verifies:

1. Settings opens from the sidebar.
2. General and Quotes & Invoices tabs are keyboard- and pointer-accessible.
3. A harmless value can be updated and persists after refresh.
4. Invalid emails, URLs, percentages, and day counts show clear errors.
5. Discard restores the saved values.
6. A stale form receives the conflict message instead of overwriting newer settings.
7. The harmless test value is restored.

No live Settings write is performed by development tooling without the owner's explicit approval.

## Delivery Boundary

The module is complete when the migration, admin-only data path, two-section page, validation,
optimistic conflict handling, activity event, tests, architecture notes, sidebar link, and manual
verification are complete. Quotes, invoices, PDFs, approval links, email delivery, payment records,
and booking conversion remain a separate sub-project built after Settings.
