# Clients Module - Design Spec

Sub-project 4 of the OPS Command Center rebuild. Sub-projects 1-3 delivered
the enquiry attachment pipeline, the styled Enquiries pages, and direct signed
uploads. This sub-project makes Clients the first complete read/write OPS
module: staff can browse, create, edit, archive, and restore client records and
manage multiple contacts per client.

Governing references:

- `docs/LGNDRY_Command_Center_Refinement_Scope.md`
- `docs/design-references/clients.png`
- `docs/design-references/view-client.png`
- `docs/architecture/application-architecture.md`

The reference images are the visual target, but several panels depend on
Projects, Invoices, Inbox, Follow-ups, or a future staff directory. This spec
only renders data backed by systems that exist now.

## Product decisions

The owner approved these decisions during the 2026-09-29 design session:

- The initial module includes creating and editing clients; it is not read-only.
- A client may have multiple contacts, with exactly one primary contact.
- Relationship status and account tier are separate concepts.
  - Status: `Lead`, `Active`, `At Risk`, `Inactive`
  - Tier: `Standard`, `Key Account`
- Archiving is represented by the existing `clients.archived` flag rather than
  a fifth stored status. The UI presents archived records as `Archived`.
- Account ownership is deferred until Settings supplies a real staff/team model.
- Client detail shows linked Enquiries now. Projects, Invoices, Communications,
  and Follow-ups are added by their own later sub-projects, without placeholders.
- Contact emails are unique across active contacts. A duplicate is blocked with
  a link to the existing client.
- Clients can be archived and restored, but never permanently deleted in the UI.
- Role/title is required for a Company contact and optional for an Individual.
- Create and edit use full pages, not dialogs.
- The list follows the Enquiries interaction: a checkbox selects an inline
  preview; the client name is a real link to the detail page.
- A website enquiry that creates a client also creates its primary contact. A
  matched enquiry links to the existing client without overwriting saved client
  or contact details.
- Summary cards are Active Clients, Key Accounts, New Leads, and Open Enquiries.

## Scope boundary

### In scope

- `/ops/clients` - searchable, filterable, sortable client list with stats and
  an inline selected-client preview.
- `/ops/clients/new` - create a client and one or more contacts.
- `/ops/clients/[id]` - full client record, contacts, linked enquiries, notes,
  and client activity.
- `/ops/clients/[id]/edit` - edit the client and its contacts.
- Archive and restore actions. No hard-delete action.
- An additive Clients schema migration, including a normalized contacts table
  and a backfill from the existing primary-contact columns.
- Atomic, admin-only create/edit/archive/restore database functions.
- Compatibility updates to enquiry-to-client matching.
- Client activity entries for create, edit, archive, and restore.
- Enabling Clients in the OPS sidebar when the module ships.

### Explicitly out of scope

- Account owner/assignee. There is one administrator and no staff directory.
- Project creation and project summaries.
- Invoice totals, balances, and invoice lists.
- Inbox communication history.
- Follow-up schedules.
- Client export or bulk actions.
- Client merging or fuzzy duplicate detection.
- Permanent client deletion.
- Retiring the legacy Contact, Booking, and Partnership forms. Those remain a
  separate website-structure sub-project.

## Data model

The live `clients` table currently has three rows and these relevant columns:
`id`, `archived`, `name`, `type`, `contact`, `email`, `phone`, `image`,
`status`, `guidelines`, `notes`, `created_at`, and `updated_at`. Existing
tables already reference `clients.id`, so the table and its primary keys stay
in place.

### Additions to `clients`

| Column | Type | Default / rules | Purpose |
| --- | --- | --- | --- |
| `account_tier` | text | `Standard`; check `Standard`, `Key Account` | Separates commercial importance from lifecycle status |
| `industry` | text, nullable | | Client category/industry |
| `region` | text, nullable | | Geographic region or base |
| `client_since` | date | current date for new records | Editable relationship start date |
| `account_overview` | text, nullable | | Editorial overview shown prominently on detail |
| `preferred_services` | text[] | empty array | Ordered service/scope labels |
| `relationship_notes` | text, nullable | | Internal relationship knowledge |

`clients.status` gains a check constraint for `Lead`, `Active`, `At Risk`, and
`Inactive`. `clients.archived` remains the archive source of truth. Existing
primary-contact columns (`contact`, `email`, `phone`) remain as a compatibility
mirror because the legacy admin/forms and current database functions still use
them. New OPS writes update those columns from the primary contact in the same
transaction.

Existing values are preserved. Null `client_since` values are backfilled from
`created_at::date`; account tier defaults to `Standard`.
`relationship_notes` is initially populated from the legacy `notes` column and
new OPS writes keep those two fields mirrored so the legacy admin continues to
show the same notes until cutover. `guidelines` is left untouched: the live data
uses it for project-specific creative briefs, not account-level CRM notes.

### New `client_contacts` table

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, generated |
| `client_id` | uuid | required FK to `clients.id`, cascade on database-only deletion |
| `full_name` | text | required |
| `role_title` | text, nullable | required by application validation for Company clients |
| `email` | text | required, trimmed and normalized for comparison |
| `phone` | text, nullable | optional |
| `is_primary` | boolean | exactly one active primary contact per active client |
| `archived` | boolean | default false; used when a client is archived |
| `created_at`, `updated_at` | timestamptz | standard timestamps |

Indexes and constraints:

- Unique `lower(trim(email))` across non-archived contact rows.
- Unique active primary contact per client through a partial index.
- Index on `client_id` for detail fetches and joins.
- Admin-only RLS using `is_admin(auth.uid())`, matching the rest of OPS.

All foreign-key columns are indexed. Database functions and the compatibility
trigger use an empty `search_path` and schema-qualified names; default function
execution is revoked from `public` and granted only to the roles each function
actually needs.

The migration aborts rather than silently discarding data if a preflight finds
duplicate active emails. The current live rows have three distinct emails.

### Backfill and compatibility

Every existing client with a non-empty email gets one primary contact. The
contact name uses the legacy `contact` value when it contains a real name and
falls back to `clients.name` for placeholders such as `Main`. Email and phone
are copied unchanged.

New client inserts made by the still-live legacy lead forms must continue to
produce a usable primary contact. A narrow database trigger creates the primary
`client_contacts` row from the legacy mirror fields after a `clients` insert.
The trigger function is `SECURITY DEFINER` because those public forms may insert
a lead client but must never receive direct write access to `client_contacts`.
The new atomic Clients functions reuse that generated row, then add any extra
contacts. They do not create a second primary contact.

The enquiry finalization function changes its match order to:

1. active `client_contacts.email`, case-insensitive;
2. legacy `clients.email`, case-insensitive, as a compatibility fallback;
3. create a client, allowing the insert trigger to create its primary contact.

Matching never overwrites client profile fields or existing contact details.
When a new enquiry includes a company, the client record uses the company as
its name and `Company` as its type; the submitted person's name belongs to the
new primary contact. Without a company, the Individual client and primary
contact both use the submitted person's name.

## Write operations

Multi-table writes must be atomic. Server Actions validate inputs and require
`requireOpsUser()` before data access, then call admin-gated
`SECURITY DEFINER` functions. The functions independently verify
`is_admin(auth.uid())`; the browser cannot call them as an anonymous customer.

### Create

`create_client_with_contacts(client_payload, contacts_payload)`:

- validates the status/tier/type combinations again in PostgreSQL;
- rejects a duplicate active contact email and returns the conflicting client id;
- inserts the client and contacts with exactly one primary;
- mirrors the primary contact into `clients.contact/email/phone`;
- inserts `ops_activity_log` with `collection = 'clients'`, the new
  `record_id`, and action `created`;
- returns the new client id for redirect to `/ops/clients/[id]`.

### Edit

`update_client_with_contacts(client_id, client_payload, contacts_payload)`:

- locks the client for the duration of the update;
- rejects missing/archived/unauthorized records;
- rejects duplicate contact emails with the conflicting client id;
- updates the profile and reconciles the submitted contact set atomically;
- updates the compatibility mirror from the primary contact;
- records one `updated` client activity entry.

Contact removal from the edit form deletes that contact row. The client record
itself is never deleted, and activity records that the client was updated.

### Archive and restore

`set_client_archived(client_id, archived)`:

- archives the client and all of its contacts together;
- preserves the stored lifecycle status for restoration;
- records `archived` or `restored` activity;
- on restore, rechecks every email before unarchiving contacts;
- blocks restore with a link to the conflicting active client if an email was
  reused while this client was archived.

Linked enquiries are never deleted or archived by this action.

### Validation and failure states

Zod schemas are shared by create and edit. Required fields:

- Client: name, type, status, tier, client-since date.
- Every contact: full name and valid email.
- Company contacts: role/title.
- Individual contacts: role/title optional.
- At least one contact; exactly one primary contact.

Optional text fields are trimmed and converted to `null`; preferred-service
labels are trimmed, deduplicated case-insensitively, and empty labels removed.
Server Actions return field-level validation errors plus a form-level error.
Database/network failures are logged with `console.error` and surfaced as a
calm retry message without losing the form values.

## `/ops/clients` list page

### Data fetch

A server-only fetch loads all clients, their active contacts, and a count of
linked enquiries. It follows the established fetch contract: try/catch,
`console.error`, and `null` on failure. The page distinguishes unavailable,
empty, and populated states. At current volume, search/filter/sort/selection
remain client-side with no pagination.

### Header and summary

Header: title and description, with a primary `New Client` link to
`/ops/clients/new`. Export is omitted.

Four stat cards:

- Active Clients - non-archived clients with status `Active`.
- Key Accounts - non-archived clients with tier `Key Account`.
- New Leads - non-archived clients with status `Lead`.
- Open Enquiries - linked enquiries not in `Completed` or `Closed`.

No unsupported trend deltas are shown.

### Filters, search, and sort

Filter tabs: All, Leads, Active, Key Accounts, At Risk, Inactive, Archived.
All excludes archived clients; Archived shows only archived clients. Key
Accounts applies tier independently of lifecycle status.

Search matches client name, primary contact name/email, any additional contact
name/email, industry, and region. Sort options: newest, oldest, name A-Z, name
Z-A. The controls and table remain stable at narrow widths through horizontal
overflow rather than compressed unreadable columns.

### Table and selection

Columns: checkbox, Client / Primary Contact, Type, Industry, Open Enquiries,
Last Activity, Status, Tier, and an actions menu. The client name is a real
`Link` to `/ops/clients/[id]`; table cells do not impersonate links.

Last Activity is the latest timestamp among the client update, linked enquiry
creation, and client activity-log entries. It is shaped server-side rather than
computed with per-row browser requests.

Selecting one checkbox reveals an inline preview with client details, account
overview, primary contact, up to three additional contacts, recent linked
enquiries, and recent client activity. The preview includes a `View Client`
link. Empty sections are omitted rather than filled with placeholder content.

## `/ops/clients/[id]` detail page

The route validates the uuid before fetching, awaits Promise-shaped params,
and returns a real 404 for malformed or missing ids. The fetch is wrapped in
React `cache()` because metadata and the page share it. Both call
`requireOpsUser()` before data access.

Header: breadcrumb, client name, primary contact summary, Back to Clients,
Edit Client, and Archive or Restore. There is no New Project button yet.

Summary cards: relationship status, account tier, contact count, open enquiry
count, and client-since date. There is no owner, lifetime value, balance, or
active-project card.

Main content:

- Account Overview.
- Preferred Services / Scope.
- Linked Enquiries with project type, submitted date, status, and a real link
  to each enquiry detail page.
- Relationship Notes, preserving line breaks.

Right rail:

- Client Details: type, industry, region, status, tier, client since.
- Contacts: primary first, then additional contacts, with `mailto:` and `tel:`
  links. Role/title is omitted when blank for an Individual.
- Recent Activity filtered by `collection = 'clients'` and this client id.

Panels for unfinished modules are not rendered. They are added in their own
sub-projects when backed by real data and navigation.

## Create and edit pages

Both pages use one reusable `ClientForm` component with separate Client Profile
and Contacts sections.

The Contacts section supports adding, editing, removing, and reordering rows.
Each row has a primary-contact radio control. Removing the primary contact is
blocked until another contact is selected. Changing client type immediately
updates role/title validation without clearing entered data.

Create defaults: Individual, Lead, Standard, today, one empty primary contact.
After success it redirects to the new detail page. Edit is prefilled from the
record and returns to detail after success. A cancel link returns without
writing. Archive/restore is not part of the form; it remains an explicit detail
page action with confirmation copy.

## Error, accessibility, and responsive behavior

- Every data page has distinct unavailable, empty, not-found, and populated
  states.
- Form errors are associated to controls and focus moves to the summary after a
  failed submit.
- Contact controls have explicit accessible names including the row's contact
  name or position.
- Keyboard users can add/remove/reorder contacts and choose the primary contact.
- Dates in client components use `Africa/Johannesburg` explicitly.
- The monochrome `ink`, `ink-muted`, `surface`, `surface-soft`, `line`, and
  `line-strong` tokens remain the entire palette.
- Mobile uses stacked profile/contact panels and horizontally scrollable tables;
  no text or controls overlap.

## Testing

### Database migration verification

Run migration SQL in a rolled-back transaction first. Assertions cover:

- backfill creates exactly one primary contact for each eligible client;
- duplicate active email and duplicate primary constraints reject invalid data;
- admin can read/write contacts, while anon and non-admin users see zero rows
  and cannot write;
- create/edit/archive/restore functions are atomic and admin-only;
- restore conflict returns the active conflicting client;
- enquiry matching finds a secondary contact and does not overwrite it.

Row-count assertions are mandatory because an RLS-denied SELECT returns zero
rows instead of raising an error.

### Unit and fetch tests

- Client shaping, status/tier presentation, summary counts, search/filter/sort,
  and last-activity selection.
- Server-only list/detail fetches with mocked `@/lib/db/server`, including
  success, not-found, and query failures.
- Form schemas: company versus individual role/title behavior, contact count,
  exactly one primary, duplicate emails within the submitted form, service
  normalization, and field limits.
- Server Actions: auth-before-data, RPC payloads, redirect ids, duplicate links,
  database errors, and archive/restore behavior.

### Component and route tests

- List stats, filters, search, sort, row selection, inline preview, and links.
- Detail rendering, linked enquiry links, contacts, activity, archive/restore,
  malformed uuid 404, missing record 404, and unavailable state.
- Create/edit contact interactions, validation, primary-contact switching,
  successful submission, duplicate-conflict link, and retained values on error.
- OPS nav marks Clients available and active for all Clients routes.

### Required verification

Every implementation task ends with the complete gate:

```text
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

After deployment, use owner-approved temporary data only: create a client with
two contacts, edit it, verify linked enquiries and activity, archive and restore
it, verify duplicate-email blocking, then remove all temporary rows. Never write
test rows to the live database without asking first.

## Documentation and delivery

When the module ships:

- append `Phase 5, sub-project 4 - Clients module` to
  `docs/architecture/application-architecture.md`;
- record deliberate deviations and any skipped live checks;
- flip Clients to available in `src/components/layout/ops-nav.tsx`;
- stage files by name only;
- push to `next-migration` after all gates pass;
- do not merge to `main` or open a pull request unless the owner asks.
