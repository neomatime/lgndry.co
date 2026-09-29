# Clients Module Implementation Plan

**Goal:** Ship a complete Clients module with list, detail, create, edit,
archive, restore, multiple contacts, duplicate-email protection, linked
enquiries, and activity history.

**Architecture:** Extend the existing `clients` table without replacing its
ids or breaking existing foreign keys. Add a normalized `client_contacts`
table and keep the legacy `clients.contact/email/phone/notes` columns as a
compatibility mirror. Server Components fetch list/detail data through
server-only functions; pure view-model modules shape it; one Client Component
owns each interactive table/form surface. Multi-table writes go through
admin-gated PostgreSQL functions so client and contact changes are atomic.

**Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, React 19 Server
Components and Server Actions, Supabase/Postgres/RLS, zod, lucide-react,
Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-clients-module-design.md`

## Non-negotiable constraints

- Work only on `next-migration`; do not merge or open a PR.
- Never stage with `git add .` or `git add -A`.
- Never stage the untracked OAuth files, owner scope documents, screenshots,
  image edits, `verify.txt`, generated `AGENTS.md`, or generated `CLAUDE.md`.
- Call `requireOpsUser()` before every Clients page/action data access,
  including `generateMetadata`.
- Fetch functions catch, log, and return `null` or an explicit result. They do
  not throw database errors into the route boundary.
- Use only the existing monochrome tokens. Add no dependency and no color.
- Use real `Link` elements. Do not make table cells clickable and do not nest a
  button in a link.
- Client-side dates explicitly use `timeZone: "Africa/Johannesburg"`.
- No owner, Projects, Invoices, Inbox, or Follow-ups UI in this sub-project.
- Do not apply schema changes until Tasks 1-7 and their gates are green.
- A task is incomplete until this full gate passes:

```powershell
pnpm format:check; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm typecheck; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm lint; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm test -- --maxWorkers=1; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm build
```

## Dependency order

1. Migration source and rollback.
2. Pure types, validation, and view models.
3. Mocked write actions.
4. Mocked read functions.
5. List page.
6. Detail page and archive/restore controls.
7. Create/edit forms and routes.
8. Navigation, documentation, whole-spec review.
9. Rolled-back SQL verification, live migration, deploy, smoke test, cleanup.

---

## Task 1: Add the Clients schema migration and rollback

**Files**

- Create: `supabase/migrations/20260929062412_clients_module.sql`
- Create: `supabase/rollbacks/20260929062412_clients_module.rollback.sql`

### Migration contract

Add to `public.clients`:

```sql
account_tier text not null default 'Standard'
  check (account_tier in ('Standard', 'Key Account')),
industry text,
region text,
client_since date not null default current_date,
account_overview text,
preferred_services text[] not null default '{}',
relationship_notes text
```

Before adding the status check, assert no existing non-null value falls outside
`Lead`, `Active`, `At Risk`, `Inactive`. Backfill `client_since` from
`created_at::date` and `relationship_notes` from `notes`. Add checks for the
four statuses and `Company`/`Individual` types.

Create `public.client_contacts`:

```sql
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  full_name text not null check (btrim(full_name) <> ''),
  role_title text,
  email text not null check (btrim(email) <> ''),
  phone text,
  is_primary boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_contacts_client_id_idx
  on public.client_contacts (client_id);
create unique index client_contacts_active_email_idx
  on public.client_contacts (lower(btrim(email)))
  where archived = false;
create unique index client_contacts_one_active_primary_idx
  on public.client_contacts (client_id)
  where is_primary = true and archived = false;
```

Attach the existing `public.set_updated_at()` trigger, enable RLS, and add the
standard admin policy. Revoke table access from `anon`; grant authenticated
table access subject to RLS.

Before backfill, raise a named exception if active legacy clients contain a
case-insensitive duplicate non-empty email. Backfill one contact per client.
Treat `Main`, `Primary`, `N/A`, and `-` as placeholder legacy contact names and
fall back to `clients.name`. Copy `clients.archived` to the contact.

Add a `SECURITY DEFINER SET search_path = ''` after-insert trigger on
`public.clients` that creates a primary contact whenever a legacy/public insert
provides a non-empty email. Fully qualify every object in the function. The
trigger must not expose direct `client_contacts` insert permission.

Add three admin-only functions, each returning JSON:

```sql
public.create_client_with_contacts(p_client jsonb, p_contacts jsonb)
public.update_client_with_contacts(p_client_id uuid, p_client jsonb, p_contacts jsonb)
public.set_client_archived(p_client_id uuid, p_archived boolean)
```

Every function must:

- independently check `public.is_admin((select auth.uid()))` and raise SQLSTATE
  `42501` when false;
- validate required keys, allowed type/status/tier, a non-empty contacts array,
  exactly one primary, Company role/title requirements, and contact ownership;
- normalize email comparisons with `lower(btrim(...))`;
- return `{ "status": "conflict", "client_id": "..." }` rather than exposing
  a constraint error when another active client owns an email;
- write `ops_activity_log` inside the same transaction with
  `collection='clients'`, `record_id`, and action `created`, `updated`,
  `archived`, or `restored`;
- mirror the primary contact into `clients.contact/email/phone` and mirror
  `relationship_notes` into legacy `clients.notes`.

Create inserts the client, reuses/removes the trigger-created contact, then
inserts the complete submitted contact set. Update locks the client, validates
every submitted contact id belongs to it, deletes removed contacts, and
updates/inserts the remaining contacts. Archive marks client and contacts
archived. Restore checks conflicts first and then unarchives both; linked
enquiries are untouched.

Recreate `public.submit_enquiry(...)` from
`20260927_enquiries_and_attachments.sql` with the same signature, validation,
attachment handling, and grants. Change only client matching and function
hardening, plus correct Company record naming:

```sql
select cc.client_id into matched_client_id
from public.client_contacts cc
join public.clients c on c.id = cc.client_id
where cc.archived = false
  and c.archived = false
  and lower(btrim(cc.email)) = lower(btrim(submit_enquiry.email))
order by cc.is_primary desc, cc.created_at asc
limit 1;

if matched_client_id is null then
  select c.id into matched_client_id
  from public.clients c
  where c.archived = false
    and lower(btrim(c.email)) = lower(btrim(submit_enquiry.email))
  order by c.created_at asc
  limit 1;
end if;
```

In the existing new-client insert, use
`coalesce(nullif(btrim(company), ''), full_name)` for `clients.name`, while the
contact mirror remains `full_name`. This makes a Company client the submitted
company and the person its primary contact; Individual behavior is unchanged.

Use `SET search_path = ''` and schema-qualify all references. Preserve execute
grants for `anon`, `authenticated`, and `service_role`; the deployed upload
finalizer still relies on them.

The rollback must restore the exact pre-migration `submit_enquiry` body and
grants, drop the three client functions and trigger function/trigger, drop
`client_contacts`, remove new constraints/columns, and leave all pre-existing
client rows untouched.

### Verification before commit

- Review function signatures against the existing Supabase `.rpc()` naming
  convention.
- Confirm rollback order removes dependants before tables/columns.
- Run the full gate (SQL is not applied yet).
- Stage only the two named SQL files and commit:
  `feat: add client relationship data model`.

---

## Task 2: Add client domain types, schemas, and pure view models

**Files**

- Create: `src/features/clients/types.ts`
- Create: `src/features/clients/schemas.ts`
- Create: `src/features/clients/schemas.test.ts`
- Create: `src/features/clients/list-view-model.ts`
- Create: `src/features/clients/list-view-model.test.ts`
- Create: `src/features/clients/detail-view-model.ts`
- Create: `src/features/clients/detail-view-model.test.ts`

### Stable domain contracts

```ts
export const CLIENT_TYPES = ["Company", "Individual"] as const;
export const CLIENT_STATUSES = ["Lead", "Active", "At Risk", "Inactive"] as const;
export const ACCOUNT_TIERS = ["Standard", "Key Account"] as const;
export const CLIENT_FILTERS = [
  "All",
  "Leads",
  "Active",
  "Key Accounts",
  "At Risk",
  "Inactive",
  "Archived",
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type AccountTier = (typeof ACCOUNT_TIERS)[number];
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export type ClientContactInput = {
  id?: string;
  fullName: string;
  roleTitle: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type ClientInput = {
  name: string;
  type: ClientType;
  status: ClientStatus;
  accountTier: AccountTier;
  industry: string;
  region: string;
  clientSince: string;
  accountOverview: string;
  preferredServices: string[];
  relationshipNotes: string;
  contacts: ClientContactInput[];
};
```

`clientInputSchema` uses zod limits and `superRefine` to enforce:

- non-empty name, valid date, one or more contacts;
- valid and unique contact emails inside the submitted form;
- exactly one primary;
- every Company contact has role/title;
- Individual role/title remains optional;
- optional strings normalize to `""` for form state;
- preferred services trim, remove blanks, and deduplicate case-insensitively.

List view-model output includes client profile, ordered contacts, primary
contact, open-enquiry count, last-activity timestamp, and archived state. Add
pure functions for the four approved stats, filter counts, search, filter, and
sort (`newest`, `oldest`, `name-asc`, `name-desc`). `All` excludes archived;
`Archived` includes only archived; `Key Accounts` filters tier independently.

Detail view-model output includes contacts (primary first), linked enquiries
(newest first), activity with relative time, and summary counts. Reuse
`relativeTime` from Enquiries rather than cloning it.

### Test cases

- Company contact without role fails; Individual without role passes.
- Zero/two primary contacts fail.
- Duplicate contact emails differing only by case/space fail.
- Services normalize and deduplicate.
- Stats return zeroes for an empty list.
- All/Archived/Key Account filters obey the approved semantics.
- Search includes every contact, industry, and region.
- Sort never mutates the input.
- Detail builder orders primary contact and enquiries/activity correctly.

Run focused tests, then the full gate. Stage only Task 2 files and commit:
`feat: add client domain models`.

---

## Task 3: Add authenticated client write actions

**Files**

- Create: `src/features/clients/actions.ts`
- Create: `src/features/clients/actions.test.ts`

### Result type

```ts
export type ClientActionResult =
  | { status: "success"; clientId: string }
  | { status: "invalid"; fieldErrors: Record<string, string[]>; error: string }
  | { status: "conflict"; clientId: string; error: string }
  | { status: "error"; error: string };
```

Export:

```ts
createClient(input: unknown): Promise<ClientActionResult>
updateClient(id: string, input: unknown): Promise<ClientActionResult>
setClientArchived(id: string, archived: boolean): Promise<ClientActionResult>
```

Each action calls `requireOpsUser()` before creating a Supabase client. Create
and update parse `clientInputSchema`, convert camelCase to the two JSON RPC
payloads, call the corresponding RPC, parse its response with zod, and call
`revalidatePath('/ops/clients')` plus the detail path on success. Archive does
the same for `set_client_archived`.

Log database/RPC failures with `console.error`, but never include client data in
the log. Convert conflict results to a stable message and id that the UI renders
as `/ops/clients/{id}`. Do not redirect in the action; the client form controls
navigation after success and retains values on all failures.

### Tests

- Auth guard runs before `createSupabaseServerClient`.
- Invalid input never opens a DB client.
- RPC payload uses snake_case keys and normalized services/contacts.
- Success returns id and revalidates both paths.
- Conflict preserves the returned client id.
- RPC/shape failures return generic error and log.
- Archive/restore passes the boolean and handles conflict.

Run focused tests and the full gate. Commit only these files:
`feat: add client write actions`.

---

## Task 4: Add list/detail data access

**Files**

- Create: `src/features/clients/fetch-clients.ts`
- Create: `src/features/clients/fetch-clients.test.ts`
- Create: `src/features/clients/fetch-client-detail.ts`
- Create: `src/features/clients/fetch-client-detail.test.ts`

### List fetch

`fetchClients(): Promise<ClientListItem[] | null>`:

1. Load all client fields plus `client_contacts` and linked enquiry
   `id/status/created_at` values, newest clients first.
2. Load all `ops_activity_log` rows where `collection='clients'` in one query.
3. Build a latest-activity map; do no per-client calls.
4. Return shaped rows or log `Could not load clients` and return `null`.

The view model calculates open enquiries as every linked enquiry except
`Completed`/`Closed`; Last Activity is max(client update, enquiry creation,
client activity). Include archived contacts when their parent is archived so
the archived detail can still render correctly.

### Detail fetch

```ts
type ClientDetailResult =
  | { status: "ok"; client: ClientDetail }
  | { status: "not-found" }
  | { status: "error" };

export const fetchClientDetail = cache(async (id: string): Promise<ClientDetailResult> => ...);
```

Validate UUID before opening Supabase. Fetch the client, contacts, linked
enquiries, and client activity. Treat a missing row as `not-found`; query
failures log `Could not load client` and return `error`. No project/invoice/email
queries exist in this function.

### Tests

Mock `@/lib/db/server` and assert selected columns, filters, ordering, shaping,
zero linked enquiries, archived clients, malformed id short-circuit, valid
missing id, and each query failure.

Run focused tests and the full gate. Commit Task 4 files:
`feat: add client data access`.

---

## Task 5: Build the Clients list page

**Files**

- Create: `src/features/clients/components/client-badges.tsx`
- Create: `src/features/clients/components/client-badges.test.tsx`
- Create: `src/features/clients/components/clients-table.tsx`
- Create: `src/features/clients/components/clients-table.test.tsx`
- Create: `src/app/(app)/ops/clients/page.tsx`

### Page

The Server Component calls `requireOpsUser()`, then `fetchClients()`. Render:

- `PageHeader` with approved description and a real `Link` to
  `/ops/clients/new` styled as the primary command.
- Unavailable state when fetch is `null`.
- Empty state with the New Client action when rows are empty.
- Four `StatCard`s: Active Clients, Key Accounts, New Leads, Open Enquiries.
- `ClientsTable` when populated.

Use lucide `Users`, `Star`, `UserPlus`, and `Mail` icons. Add no trend copy.

### Badges

Keep Enquiries' typed `StatusBadge` unchanged. Add feature-local
`ClientStatusBadge` and `AccountTierBadge` using only existing tokens. Archived
uses a quiet outline; Active uses neutral fill; Lead is strongest; At Risk and
Inactive remain visually distinct through border/weight, not new colors.

### Table

State: filter, search, sort, checked id. Tabs are the seven approved filters.
Controls and table live in overflow containers on small screens.

Columns: checkbox, Client / Primary Contact, Type, Industry, Open Enquiries,
Last Activity, Status, Tier, actions. The client name and View action are real
links. Use a semantic actions menu or clearly labelled icon controls; never an
`onClick` table row.

The selected preview shows real profile/contact/enquiry/activity data already
present in the list view model and a View Client link. Omit empty optional
sections.

### Component tests

- Approved filters and counts.
- Search finds a secondary contact.
- Four sort modes.
- Checkbox reveals only one preview.
- Client/detail/edit links have correct hrefs.
- Archived state renders without replacing stored lifecycle status.
- Empty filter result copy.
- Johannesburg date formatting remains deterministic.

Run focused tests and full gate. Commit Task 5 files:
`feat: build clients directory`.

---

## Task 6: Build client detail and archive/restore controls

**Files**

- Create: `src/features/clients/components/client-archive-control.tsx`
- Create: `src/features/clients/components/client-archive-control.test.tsx`
- Create: `src/features/clients/components/client-detail.tsx`
- Create: `src/features/clients/components/client-detail.test.tsx`
- Create: `src/app/(app)/ops/clients/[id]/page.tsx`

### Route behavior

Both `generateMetadata` and the page call `requireOpsUser()` before the cached
fetch. Await Promise-shaped params. Malformed/missing ids call `notFound()`;
query failure renders a distinct temporary-unavailable state.

Header actions are Back to Clients, Edit Client, and Archive/Restore. Archived
clients do not show Edit until restored. No New Project button.

Summary cards: Status, Tier, Contacts, Open Enquiries, Client Since.

Main column: Account Overview, Preferred Services / Scope, Linked Enquiries,
Relationship Notes. Right rail: Client Details, Contacts, Recent Activity.
Optional empty content gets a quiet local empty state, not invented data.

Linked enquiries use `/ops/enquiries/[id]` links and the existing
`StatusBadge`. Contact email/phone use `mailto:`/`tel:`. Primary is labelled;
role/title is omitted when blank.

### Archive control

A Client Component asks for confirmation through an accessible native dialog
or an inline confirmation state, then calls `setClientArchived`. On success it
refreshes. On a restore conflict it renders a real link to the active client.
The control prevents duplicate submissions and exposes failure text with
`role='alert'`.

### Tests

- Every approved panel renders from fixture data.
- No owner/project/invoice/inbox/follow-up panel is present.
- Linked enquiry links/statuses are correct.
- Archived detail hides Edit and offers Restore.
- Archive/restore success refreshes; conflict shows link; failure is announced.
- Detail route's malformed/missing/error behavior is covered at the fetch/page
  boundary without making real Supabase calls.

Run focused tests and full gate. Commit Task 6 files:
`feat: build client detail view`.

---

## Task 7: Build create/edit forms and routes

**Files**

- Create: `src/features/clients/components/client-form.tsx`
- Create: `src/features/clients/components/client-form.test.tsx`
- Create: `src/app/(app)/ops/clients/new/page.tsx`
- Create: `src/app/(app)/ops/clients/[id]/edit/page.tsx`

### `ClientForm`

Props:

```ts
type ClientFormProps =
  | { mode: "create"; initialValue?: never }
  | { mode: "edit"; initialValue: ClientInput & { id: string } };
```

Own controlled state for the profile and contacts. Create defaults:
Individual, Lead, Standard, today's date, empty optional fields, and one empty
primary contact. Use native form controls styled with existing OPS tokens.

Profile fields: name, type, status, tier, industry, region, client since,
account overview, preferred services, relationship notes. Preferred services
use a compact repeatable text control with add/remove icon buttons; do not parse
a comma-delimited string implicitly.

Contact rows: full name, role/title, email, phone, primary radio, move up/down,
remove. Role/title marks required only for Company. Removing the primary is
blocked until another contact is chosen. One blank contact cannot be removed.
Icon buttons use lucide icons and accessible labels/tooltips.

Submit runs the same zod schema client-side for immediate field feedback, then
calls the relevant Server Action in a transition. Retain values after invalid,
conflict, or network failure. Success uses `router.push` to the returned detail
id and `router.refresh()`. Conflict text includes a real View Existing Client
link. Cancel is a real link.

### Routes

- New page: auth, metadata, PageHeader, `ClientForm mode='create'`.
- Edit page: auth before cached detail fetch, UUID/missing 404, unavailable
  state, archived record redirects or links back to detail, and maps detail to
  form input without losing contact ids.

### Tests

- Create defaults and all labels.
- Add, remove, reorder, and switch primary contact.
- Company role required; Individual role optional.
- Preferred service add/remove/deduplication.
- Submit calls create/update with normalized payload.
- Success navigation; duplicate conflict link; generic error; values retained.
- Busy state prevents duplicate submission.
- Edit prefill preserves ids and optional empty values.

Run focused tests and full gate. Commit Task 7 files:
`feat: add client create and edit flows`.

---

## Task 8: Integrate navigation and documentation; review against spec

**Files**

- Modify: `src/components/layout/ops-nav.tsx`
- Create: `src/components/layout/ops-nav.test.tsx`
- Modify: `docs/architecture/application-architecture.md`
- Modify if review finds drift: Clients files from Tasks 1-7

Flip only Clients to `available: true`; preserve the mandated order. Test that
Clients is a link, nested Clients routes mark it current, and unfinished items
remain disabled.

Append `Phase 5, sub-project 4 - Clients module` with What's New, Data Model,
Deliberate Deviations, Compatibility, Verification, and Still Open. Do not edit
older architecture sections to rewrite history.

Review every approved spec line against the implementation. Explicitly inspect:

- multiple contacts and one primary;
- duplicate active-email conflict links;
- Individual optional versus Company required role/title;
- no hard delete;
- archive/restore preserves linked enquiries;
- legacy mirror and enquiry matching;
- no owner or unfinished-module placeholders;
- all four summary cards;
- list checkbox preview and real navigation links;
- auth-before-data and cached detail fetch;
- every error/empty/not-found state;
- no new colors/dependencies.

Run the full gate. Stage only named files. Commit:
`feat: integrate clients module`.

---

## Task 9: Verify SQL, apply live migration, deploy, and smoke test

This task touches the live project `tscaluhtfrvwlwjybfsg`. Do not create test
rows until the owner explicitly approves the smoke-test write.

### 9.1 Rolled-back migration verification

Use a single `BEGIN ... ROLLBACK` execution against the live database containing
the complete migration plus assertions. Do not use an RLS error as the only
proof: assert row counts because denied SELECT returns zero rows.

Verify:

- three current clients become three contacts, one primary each;
- current ids/foreign keys remain unchanged;
- duplicate active email fails;
- two primaries for one client fail;
- anon and a non-admin cannot see/write `client_contacts`;
- admin can read/write;
- create/edit/archive/restore functions are atomic and reject non-admins;
- archiving frees an email; reuse causes restore to return conflict;
- `submit_enquiry` matches an existing secondary contact;
- the transaction leaves zero persistent changes.

Fix migration/rollback and rerun Task 8's full gate if any assertion fails.

### 9.2 Apply and verify schema

Apply `20260929062412_clients_module.sql` once with the Supabase migration tool.
Immediately verify migration presence, columns, indexes, policies, function
grants, contact backfill count, primary count, and no unexpected duplicate.
Run Supabase security/performance advisors and record relevant findings; do not
bundle unrelated advisor cleanup into this module.

### 9.3 Push and deploy

Run the full gate again. Confirm `git status --short` contains only intended
commits plus the known unrelated local files. Push `next-migration`. Wait for
GitHub/Vercel status to report success and open the stable preview.

### 9.4 Owner-approved smoke test and cleanup

After explicit approval to write temporary live data:

1. Sign in with the owner-provided OPS account.
2. Create a clearly labelled temporary Individual with two contacts.
3. Confirm list stats/filter/search/selection and detail contacts/activity.
4. Edit profile, switch primary contact, and confirm mirror fields.
5. Submit or create a temporary linked enquiry only if needed and approved;
   confirm its detail link, then remove it.
6. Confirm a duplicate email is blocked with a working existing-client link.
7. Archive, confirm it leaves All and appears in Archived, then restore.
8. Confirm malformed `/ops/clients/not-a-real-id` is a 404.
9. Delete temporary rows/objects with an owner-approved cleanup query; clients
   have no hard-delete UI, so cleanup is an explicit test-only database action.
10. Query by the unique test marker and assert zero remaining client, contact,
    enquiry, and activity rows.

Record the smoke result and cleanup evidence in the architecture entry. If the
owner declines the live write, record the skipped check rather than claiming it
passed.

### 9.5 Final delivery

Commit any verification-only documentation update, push `next-migration`, and
report commit ids, gate totals, migration status, deployment URL, smoke-test
result, and any residual risks. Do not merge to `main`.
