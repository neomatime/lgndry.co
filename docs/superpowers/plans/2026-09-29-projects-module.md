# Projects Module Implementation Plan

**Goal:** Ship a complete Projects module with an active production kanban,
terminal outcome views, create/edit/archive/restore flows, structured milestones,
tasks and deliverables, enquiry conversion, linked client/contact and legacy
booking records, lightweight finance/delivery snapshots, and activity history.

**Architecture:** Extend the existing `projects` table without replacing its
UUIDs, client/booking foreign keys, or legacy text fields. Add normalized child
tables for the production plan and retain selected legacy columns as mirrors.
Server Components fetch through server-only functions; pure view-model modules
shape board/detail data; focused Client Components own the board, forms, and
quick actions. Multi-table writes use admin-gated PostgreSQL functions so
conversion, plan reconciliation, movement, synchronization, and activity are
atomic.

**Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, React 19 Server
Components and Server Actions, Supabase/Postgres/RLS, zod, lucide-react,
`@dnd-kit/core`, `@dnd-kit/sortable`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-projects-module-design.md`

## Non-negotiable constraints

- Work only on `next-migration`; do not merge or open a PR.
- Never stage with `git add .` or `git add -A`.
- Never stage OAuth material, owner scope documents, screenshots, unrelated
  image edits, `verify.txt`, generated `AGENTS.md`, or generated `CLAUDE.md`.
- Call `requireOpsUser()` before every Projects page/action data access,
  including `generateMetadata`.
- Fetch functions catch, log, and return `null` or an explicit result. They do
  not throw database failures into routes.
- Keep pure types, schemas, and view-model shaping separate from server-only
  fetches and interactive components.
- Use only existing monochrome tokens. Add no colored status system.
- Use real `Link` elements and never nest a button inside a link.
- Client-side dates specify `timeZone: "Africa/Johannesburg"`.
- Drag-and-drop is never the only stage-change path.
- Do not apply the schema migration until Tasks 1-9 and their gates are green.
- Do not create temporary live records without explicit owner approval.
- Every task is incomplete until this full gate passes:

```powershell
pnpm format:check; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm typecheck; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm lint; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm test; if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm build
```

## Dependency order

1. Migration source and rollback.
2. Drag dependency, domain contracts, validation, and pure view models.
3. Authenticated write actions.
4. List/detail/form-option data access.
5. Projects list, board, and terminal views.
6. Project detail and quick actions.
7. Create/edit/conversion forms and routes.
8. Client and enquiry integration.
9. Navigation, documentation, and whole-spec review.
10. Rolled-back SQL verification, live migration, deploy, smoke test, cleanup.

---

## Task 1: Add the Projects schema migration and rollback

**Files**

- Create: `supabase/migrations/20260929123000_projects_module.sql`
- Create: `supabase/rollbacks/20260929123000_projects_module.rollback.sql`

### Migration preflight

Before DDL, assert:

- every existing project has a non-empty name and valid client id;
- every non-null booking id resolves;
- no existing lifecycle value is outside the eight allowed values after mapping
  known legacy values;
- no existing project/client pairing would make the selected primary contact
  invalid;
- there is no existing duplicate enquiry relationship, once added;
- every non-empty legacy task/deliverable line can be preserved as text.

Never guess budget amounts, milestone dates, or terminal outcomes from prose.

### Extend `projects`

```sql
alter table public.projects
  add column enquiry_id uuid references public.enquiries(id) on delete set null,
  add column client_contact_id uuid
    references public.client_contacts(id) on delete set null,
  add column project_type text not null default 'Other',
  add column services text[] not null default '{}',
  add column location text,
  add column start_date date,
  add column end_date date,
  add column people_resources text,
  add column budget_min numeric(12,2),
  add column budget_max numeric(12,2),
  add column currency text not null default 'ZAR',
  add column payment_status text not null default 'Not Invoiced',
  add column delivery_status text not null default 'Not Ready',
  add column stage_position integer not null default 0;
```

Add named checks for:

```text
status: Planning | Pre-Production | Production | Review | Delivery |
        Completed | On Hold | Cancelled
project_type: Documentary | Event | Film | Visual Production | Other
payment_status: Not Invoiced | Deposit Pending | Partially Paid | Paid
delivery_status: Not Ready | Ready for Delivery | Delivered
start_date <= end_date when both exist
budget_min >= 0 and budget_max >= 0
budget_min <= budget_max when both exist
currency matches ^[A-Z]{3}$
stage_position >= 0
```

Add a unique partial index on non-null `enquiry_id`, plus indexes on `client`,
`client_contact_id`, `booking`, active `status/stage_position`, and `start_date`.
Backfill:

- `project_type` from a valid legacy `type`, otherwise `Other`;
- `client_contact_id` from the active primary contact belonging to `client`;
- missing `start_date`, `end_date`, and `location` from a linked booking;
- `stage_position` using `row_number()` within status ordered by
  `created_at, id`;
- keep the legacy `timeline` untouched as schedule notes.

Add a trigger guard that rejects a selected contact whose `client_id` differs
from `projects.client` or whose contact is archived. The write functions repeat
this validation and return a controlled result.

### Structured child tables

Create `project_milestones`, `project_tasks`, and `project_deliverables` exactly
as specified. Every table has:

- generated UUID primary key;
- required `project_id` FK with `on delete cascade`;
- required non-empty title;
- non-negative `sort_order`, unique per project;
- created/updated timestamps and `set_updated_at` trigger;
- project-id index;
- admin-only RLS policy using `public.is_admin((select auth.uid()))`;
- table grants revoked from `anon` and granted to `authenticated` subject to RLS.

Checks:

```sql
project_milestones.status in ('Pending', 'Completed')
project_deliverables.status in ('Not Started', 'In Progress', 'Ready', 'Delivered')
```

Backfill each non-empty trimmed line from legacy `tasks` and `deliverables` in
source order. Backfill is idempotent within migration execution and never
creates a child row when a structured row already exists.

### Atomic functions

Create these `SECURITY DEFINER SET search_path = ''` functions:

```sql
public.create_project_with_plan(
  p_project jsonb,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
) returns jsonb

public.convert_enquiry_to_project(
  p_enquiry_id uuid,
  p_project jsonb,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
) returns jsonb

public.update_project_with_plan(
  p_project_id uuid,
  p_project jsonb,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
) returns jsonb

public.move_project(
  p_project_id uuid,
  p_status text,
  p_stage_position integer
) returns jsonb

public.set_project_milestone_completed(
  p_milestone_id uuid,
  p_completed boolean
) returns jsonb

public.set_project_task_completed(
  p_task_id uuid,
  p_completed boolean
) returns jsonb

public.set_project_deliverable_status(
  p_deliverable_id uuid,
  p_status text
) returns jsonb

public.set_project_archived(
  p_project_id uuid,
  p_archived boolean
) returns jsonb
```

Every function:

- checks `public.is_admin((select auth.uid()))` and raises SQLSTATE `42501` for
  non-admin callers;
- validates all enum values, date/budget rules, client/contact ownership, child
  ownership, child ordering, and required values again in PostgreSQL;
- locks the project or source enquiry before making decisions;
- fully qualifies every object;
- writes `ops_activity_log` in the same transaction;
- returns JSON with `status: ok | not-found | conflict | invalid` and relevant
  ids/details instead of leaking expected constraint errors.

`create_project_with_plan` inserts the project and all ordered children,
assigning a default contact and the end of the selected stage when omitted.
It serializes tasks/deliverables to newline-delimited legacy mirrors and mirrors
`project_type`, overview, and schedule notes into `type`, `brief`, and
`timeline`.

`convert_enquiry_to_project` locks an active enquiry, rejects `Completed`,
`Closed`, or an existing project with that `enquiry_id`, requires its active
client, creates the project/plan, sets the enquiry to `Booked`, and records one
activity event against each record. The project payload may refine but not
replace the source client id.

`update_project_with_plan` locks an active project, validates every submitted
child id belongs to it, updates/inserts rows, deletes omitted child rows, compacts
ordering, and updates all mirrors atomically.

`move_project` locks rows in deterministic id order, removes the project from
its source ordering, inserts it at the clamped destination position, and
compacts both affected stages. It supports all eight lifecycle values. On entry
to `Production` or `Completed`, update a linked enquiry to `In Production` or
`Completed` respectively and record its activity. Never downgrade or reopen an
enquiry on other movement.

The three quick functions set/clear `completed_at`, update legacy mirrors where
applicable, and record activity only when the stored value changes.

`set_project_archived` preserves lifecycle status and child records. Restore
appends to the end of its stored status ordering. It never changes linked client,
enquiry, or booking rows.

Explicitly revoke function execution from `PUBLIC`, `anon`, `authenticated`,
and `service_role`, then grant only the eight public OPS RPCs to
`authenticated`. Trigger helpers receive no API-role execution grant.

### Rollback

The rollback drops new functions, guards, child tables, checks, indexes, and
columns in dependency order. It preserves the existing `projects` rows, UUIDs,
legacy values, client/booking links, and the pre-module admin RLS policy. It does
not delete projects created after rollout; their legacy mirrors remain readable.

### Tests and verification

Add no application test in this task. Review SQL manually, then run the full
five-command gate. Commit only the migration and rollback:

```text
feat: add project production data model
```

---

## Task 2: Add dependencies, domain types, schemas, and view models

**Files**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/features/projects/types.ts`
- Create: `src/features/projects/schemas.ts`
- Create: `src/features/projects/schemas.test.ts`
- Create: `src/features/projects/list-view-model.ts`
- Create: `src/features/projects/list-view-model.test.ts`
- Create: `src/features/projects/detail-view-model.ts`
- Create: `src/features/projects/detail-view-model.test.ts`
- Create: `src/features/projects/conversion-view-model.ts`
- Create: `src/features/projects/conversion-view-model.test.ts`

Install exact compatible versions through pnpm:

```powershell
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Stable contracts

```ts
export const ACTIVE_PROJECT_STAGES = [
  "Planning",
  "Pre-Production",
  "Production",
  "Review",
  "Delivery",
] as const;

export const PROJECT_OUTCOMES = ["Completed", "On Hold", "Cancelled"] as const;
export const PROJECT_STATUSES = [...ACTIVE_PROJECT_STAGES, ...PROJECT_OUTCOMES] as const;
export const PROJECT_TYPES = [
  "Documentary",
  "Event",
  "Film",
  "Visual Production",
  "Other",
] as const;
export const PAYMENT_STATUSES = [
  "Not Invoiced",
  "Deposit Pending",
  "Partially Paid",
  "Paid",
] as const;
export const DELIVERY_STATUSES = [
  "Not Ready",
  "Ready for Delivery",
  "Delivered",
] as const;
export const DELIVERABLE_STATUSES = [
  "Not Started",
  "In Progress",
  "Ready",
  "Delivered",
] as const;
```

Define database rows, list rows, detail records, client/contact options,
conversion source, form values, milestone/task/deliverable values, board columns,
summary counts, and typed Server Action results. Avoid importing server-only
modules from these files.

### Validation

`projectFormSchema` validates:

- non-empty name and client UUID;
- optional contact UUID;
- controlled project/status/payment/delivery values;
- trimmed unique service tags;
- ISO date strings and start <= end;
- nullable non-negative budget values and min <= max;
- uppercase three-letter currency;
- non-empty child titles, optional dates, controlled statuses;
- stable unique child ids when present;
- contiguous client-side sort order after normalization.

Use `z.preprocess` for empty optional number/date fields. Keep server validation
authoritative; client validation exists for useful error messages.

### Pure list model

Implement:

```ts
shapeProjectRows(rows): ProjectListItem[]
summarizeProjects(rows): ProjectSummary
buildBoard(rows): Record<ActiveProjectStage, ProjectListItem[]>
filterProjects(rows, filters): ProjectListItem[]
sortProjects(rows, sort): ProjectListItem[]
moveProjectOptimistically(board, movement): Board
getDeliverableProgress(project): { completed: number; total: number; percent: number }
getNextAction(project): ProjectTask | null
```

Search includes project, client, contact name/email, type, services, location,
and overview. Active board order is always `stage_position`, then creation/id as
a deterministic fallback. Terminal sorting follows the selected sort.

### Pure detail and conversion models

Shape detail tabs and right-rail sections without React. Conversion mapping:

- keeps the source client fixed;
- defaults contact to the active primary client contact;
- maps a controlled enquiry type and otherwise chooses `Other`;
- copies description to overview and location directly;
- parses only unambiguous ISO date or same-date values;
- displays unparsed timeline and budget as source-reference text;
- does not guess budget numbers from ranges with unclear currency/format.

Tests cover every enum, cross-field validation, date/budget edges, search field,
filter, sort, stage order, progress edge, optimistic move/rollback input,
next-action selection, and conversion mapping.

Run the full gate and commit:

```text
feat: add project domain models
```

---

## Task 3: Add authenticated project write actions

**Files**

- Create: `src/features/projects/actions.ts`
- Create: `src/features/projects/actions.test.ts`

Export Server Actions:

```ts
createProjectAction(previousState, formData)
convertEnquiryToProjectAction(enquiryId, previousState, formData)
updateProjectAction(projectId, previousState, formData)
moveProjectAction(input)
setProjectMilestoneCompletedAction(input)
setProjectTaskCompletedAction(input)
setProjectDeliverableStatusAction(input)
setProjectArchivedAction(input)
```

Every action:

1. calls `requireOpsUser()` first;
2. validates ids and payload before database calls;
3. creates the request-scoped Supabase server client;
4. invokes exactly one matching RPC;
5. maps RPC JSON/errors to the typed result;
6. revalidates only affected project, projects, client, and enquiry paths;
7. redirects only after a successful create/convert/update where appropriate.

Form submissions encode the three child arrays as JSON hidden fields generated
from controlled React state. Parse with a shared helper and reject malformed or
oversized arrays. Cap each collection at 100 records and each text field at the
schema-defined limit.

Tests mock `@/lib/auth/require-ops-user`, `@/lib/db/server`, `next/cache`, and
`next/navigation`. Cover auth ordering, malformed ids, validation summaries,
every RPC mapping, not-found/conflict/invalid results, revalidation paths,
redirects, and thrown Supabase client failures.

Run the full gate and commit:

```text
feat: add project write actions
```

---

## Task 4: Add project data access

**Files**

- Create: `src/features/projects/fetch-projects.ts`
- Create: `src/features/projects/fetch-projects.test.ts`
- Create: `src/features/projects/fetch-project-detail.ts`
- Create: `src/features/projects/fetch-project-detail.test.ts`
- Create: `src/features/projects/fetch-project-form-options.ts`
- Create: `src/features/projects/fetch-project-form-options.test.ts`
- Create: `src/features/projects/fetch-project-conversion.ts`
- Create: `src/features/projects/fetch-project-conversion.test.ts`

All modules import `server-only`, wrap Supabase calls in `try/catch`, log a
specific `console.error`, and return null or explicit result unions.

### List query

Fetch projects with client, selected contact, child counts/statuses, next task,
linked enquiry id, booking id, and recent activity required by the inline
preview. Do not fetch deferred file/communication/invoice data. Shape in the
pure list model.

### Detail query

Validate UUID before any query. Fetch one project with client/contact, complete
ordered child sets, linked enquiry summary, optional booking snapshot, and
project-filtered activity. Return:

```ts
type FetchProjectDetailResult =
  | { status: "ok"; project: ProjectDetail }
  | { status: "not-found" }
  | { status: "error" };
```

Include archived projects so the Archived view can open and restore them.

### Form options and conversion

Fetch active clients with active ordered contacts. Edit additionally fetches
the project form value. Conversion validates the enquiry UUID, fetches the
enquiry and its client/contacts, rejects terminal or already converted sources,
and returns source-reference text plus prefilled form values.

Tests cover successful shapes, empty relations, malformed ids, archived detail,
conversion conflicts, not-found, and every Supabase error branch.

Run the full gate and commit:

```text
feat: add project data access
```

---

## Task 5: Build the Projects list and kanban

**Files**

- Create: `src/app/(app)/ops/projects/page.tsx`
- Create: `src/features/projects/components/project-badges.tsx`
- Create: `src/features/projects/components/project-badges.test.tsx`
- Create: `src/features/projects/components/projects-board.tsx`
- Create: `src/features/projects/components/projects-board.test.tsx`
- Create: `src/features/projects/components/project-card.tsx`
- Create: `src/features/projects/components/project-card.test.tsx`
- Create: `src/features/projects/components/projects-table.tsx`
- Create: `src/features/projects/components/projects-table.test.tsx`
- Create: `src/features/projects/components/project-preview.tsx`
- Create: `src/features/projects/components/project-preview.test.tsx`

The page calls `requireOpsUser()` before `fetchProjects()`, renders an explicit
temporary-unavailability state on null, and otherwise renders:

- Projects heading and concise production-focused subtitle;
- New Project link;
- four `StatCard`s with factual counts;
- Active, Completed, On Hold, Cancelled, and Archived views;
- search, client/type/payment/delivery filters, and sort;
- five-column active board or compact terminal table;
- one checkbox-selected inline preview.

Use `DndContext`, keyboard and pointer sensors, `SortableContext`, and stable
project ids. On drag end, calculate the destination stage/position, update local
state optimistically, call `moveProjectAction`, and restore the previous board
with an inline error if persistence fails. Disable drag for archived and terminal
table views. Change stage menus call the same action and state transition.

Cards expose a real project-name link, explicit checkbox, project context, next
action, date, payment badge, and progress. Card menus use buttons only for
commands and never wrap links. Columns have stable responsive widths and mobile
snap behavior.

Tests cover summary counts, all views, search/filter/sort, stage order, links,
selection, preview content, keyboard/menu movement, successful drag, failed
optimistic rollback, empty columns, no-results, and unavailable state.

Run the full gate and commit:

```text
feat: build projects kanban
```

---

## Task 6: Build project detail and quick actions

**Files**

- Create: `src/app/(app)/ops/projects/[id]/page.tsx`
- Create: `src/features/projects/components/project-detail.tsx`
- Create: `src/features/projects/components/project-detail.test.tsx`
- Create: `src/features/projects/components/project-stage-control.tsx`
- Create: `src/features/projects/components/project-stage-control.test.tsx`
- Create: `src/features/projects/components/project-plan.tsx`
- Create: `src/features/projects/components/project-plan.test.tsx`
- Create: `src/features/projects/components/project-archive-control.tsx`
- Create: `src/features/projects/components/project-archive-control.test.tsx`

Wrap the detail fetch in React `cache()` because the page and
`generateMetadata` both use it. Both call `requireOpsUser()` before data access,
await Promise params, validate the UUID, return 404 for malformed/missing ids,
and render a distinct error state for database failure.

Render:

- breadcrumb, project/client title, lifecycle badge, Back, Edit, Change stage,
  and Archive/Restore controls;
- summary cards for stage, payment, dates, budget, and deliverable progress;
- Overview, Plan, and Activity tabs;
- overview, services, schedule, people/resources, contact, delivery state,
  source enquiry link, and optional read-only booking snapshot;
- ordered milestones, tasks, and deliverables with quick status controls;
- right rail with details, next actions, progress, lightweight finance, and
  linked-record shortcuts.

Controls use `useTransition`, disable while pending, announce success/failure,
and preserve current UI on failure. Archive/restore requires inline confirmation.
Archived projects show Restore and no edit/move/quick-completion controls.

Tests cover metadata/auth order, malformed/missing/error states, all tab content,
linked record visibility, booking absence/presence, quick actions, no-op/failure,
stage controls, archive confirmation, archived behavior, and accessibility.

Run the full gate and commit:

```text
feat: build project detail view
```

---

## Task 7: Build create, edit, and enquiry-conversion flows

**Files**

- Create: `src/app/(app)/ops/projects/new/page.tsx`
- Create: `src/app/(app)/ops/projects/[id]/edit/page.tsx`
- Create: `src/features/projects/components/project-form.tsx`
- Create: `src/features/projects/components/project-form.test.tsx`
- Create: `src/features/projects/components/project-plan-editor.tsx`
- Create: `src/features/projects/components/project-plan-editor.test.tsx`

`/ops/projects/new` reads optional `searchParams.enquiry`. Without it, fetch
all active client/contact options and render standalone create. With a UUID,
fetch conversion context; malformed/missing/terminal/already-converted sources
return the appropriate 404 or linked-project conflict state.

The controlled `ProjectForm` has Profile, Schedule, Production, Financial
Snapshot, and Plan sections. Client change resets an incompatible contact;
contact options are derived only from the chosen client. Repeaters support add,
remove, up/down reordering, and stable local keys. Do not use drag inside forms.

Conversion mode:

- fixes the client to the enquiry client;
- links back to the source enquiry;
- labels mapped values as editable defaults;
- shows unparsed timeline/budget source text beside empty structured fields;
- requires a confirmation checkbox that submission marks the enquiry Booked;
- calls `convertEnquiryToProjectAction`.

Edit fetches project detail/form options, blocks archived editing, and calls
`updateProjectAction`. Create calls `createProjectAction`. Both render a focused
error summary with anchor links plus inline messages, preserve submitted state
on errors, link conversion conflicts to the existing project, and redirect to
detail on success.

Tests cover standalone and conversion defaults, client/contact reset, every
field, conditional source reference, date/budget validation, plan add/remove/
reorder, status options, error focus, pending state, conflict link, successful
action payload, and route auth/not-found/error behavior.

Run the full gate and commit:

```text
feat: add project create and edit flows
```

---

## Task 8: Integrate Projects into Clients and Enquiries

**Files**

- Modify: `src/features/clients/types.ts`
- Modify: `src/features/clients/fetch-clients.ts`
- Modify: `src/features/clients/fetch-clients.test.ts`
- Modify: `src/features/clients/fetch-client-detail.ts`
- Modify: `src/features/clients/fetch-client-detail.test.ts`
- Modify: `src/features/clients/list-view-model.ts`
- Modify: `src/features/clients/list-view-model.test.ts`
- Modify: `src/features/clients/detail-view-model.ts`
- Modify: `src/features/clients/detail-view-model.test.ts`
- Modify: `src/features/clients/components/clients-table.tsx`
- Modify: `src/features/clients/components/clients-table.test.tsx`
- Modify: `src/features/clients/components/client-detail.tsx`
- Modify: `src/features/clients/components/client-detail.test.tsx`
- Modify: `src/features/enquiries/types.ts`
- Modify: `src/features/enquiries/fetch-enquiry-detail.ts`
- Modify: `src/features/enquiries/fetch-enquiry-detail.test.ts`
- Modify: `src/features/enquiries/detail-view-model.ts`
- Modify: `src/features/enquiries/detail-view-model.test.ts`
- Modify: `src/features/enquiries/components/enquiry-detail-tabs.tsx`
- Modify: `src/features/enquiries/components/enquiry-detail-tabs.test.tsx`
- Modify: `src/app/(app)/ops/enquiries/[id]/page.tsx`

Client list/detail queries add only project fields required for summaries:
id, name, status, start/end dates, delivery status, and archived. Client preview
shows up to three recent active projects plus total count after Enquiries. Client
detail renders all linked projects with real links and a clear empty state.

Enquiry detail queries one project by unique `enquiry_id`. Eligible enquiries
render a real `Create Project` link to `/ops/projects/new?enquiry=<id>`.
Converted enquiries render `Open Project`. Completed/Closed unconverted
enquiries render neither action. Do not add general enquiry editing.

Update tests for query selections, pure shapes, empty/error behavior, links,
eligibility rules, and existing component regressions.

Run the full gate and commit:

```text
feat: connect projects to clients and enquiries
```

---

## Task 9: Integrate navigation and documentation; review against spec

**Files**

- Modify: `src/components/layout/ops-nav.tsx`
- Modify: `src/components/layout/ops-nav.test.tsx`
- Modify: `src/components/ops/status-badge.tsx`
- Modify: `src/components/ops/status-badge.test.tsx`
- Modify: `docs/architecture/application-architecture.md`

Set Projects `available: true` while preserving nav order. Add monochrome badge
support for project, payment, delivery, milestone, and deliverable values only
when a shared badge improves consistency; project-specific labels may remain in
the Projects feature.

Architecture documentation records:

- additive schema and conservative one-row backfill;
- legacy mirror behavior and booking compatibility;
- canonical one-way enquiry relationship and one-way status synchronization;
- atomic RPC and explicit default-grant handling;
- drag library and accessible menu fallback;
- deliberate omission of owner, Files, Communication, and full Finance panels;
- client/enquiry integration;
- live verification and any advisor findings after Task 10.

Perform a whole-module review against every spec bullet, both project mockups,
the real schema, route conventions, and migration ordering. Search for stale
disabled nav entries, placeholder controls, non-Link navigation, missing time
zones, nested interactive elements, uncontrolled layout dimensions, and dropped
error states. Fix findings before the final gate.

Run the full gate and commit:

```text
feat: integrate projects module
```

---

## Task 10: Verify SQL, apply live migration, deploy, and smoke test

### 10.1 Rolled-back migration verification

Use one `BEGIN ... ROLLBACK` transaction against live project
`tscaluhtfrvwlwjybfsg`. Execute the complete migration body plus assertions for
every database item in the spec. Record before/after counts and ids. Test anon,
non-admin, admin, invalid payloads, conversion, movement/order, one-way enquiry
sync, all quick actions, archive/restore, activity attribution, and RLS row
counts. The transaction must end with no persistent rows or schema changes.

If live legacy data violates preflight, stop and report it. Do not mutate or
delete owner data to make the migration pass.

### 10.2 Apply and inspect

Apply through the Supabase migration API only after the rollback run and full
repository gate pass. Inspect:

- remote migration history;
- all columns, checks, FKs, indexes, triggers, tables, policies, and function
  ACLs;
- project/child/client/contact/enquiry/booking counts and relationship validity;
- legacy row preservation and child backfill;
- duplicate enquiry links or invalid selected contacts;
- security and performance advisors.

Fix new module-specific advisor findings with an additive migration, rollback,
another full gate, and another live ACL/schema check. Preserve intentional
authenticated `SECURITY DEFINER` warnings only where the function independently
checks admin status.

### 10.3 Push and deploy

Stage every file by name, verify the cached diff, and push `next-migration`.
Wait for the Vercel status on the exact commit to reach success and record the
preview URL. Do not merge or create a PR.

### 10.4 Owner-approved smoke test and cleanup

Only after explicit approval for temporary live rows and with an authenticated
admin session:

1. create a throwaway enquiry/client fixture only if an existing safe source is
   not approved for conversion;
2. convert the enquiry and confirm it becomes Booked;
3. verify the project appears in the correct board position and on the client;
4. drag and menu-move it, checking Production/Completed enquiry synchronization;
5. edit the profile, dates, budget, resources, milestones, tasks, deliverables;
6. exercise milestone/task/deliverable quick actions and activity;
7. verify archive/restore and terminal views;
8. confirm malformed project ids return 404;
9. delete every temporary child, activity, project, enquiry, contact/client, and
   storage row created by the smoke test;
10. query by unique fixture marker and assert zero remaining rows.

Do not use the existing live project for destructive smoke actions without the
owner's explicit permission.

### 10.5 Final delivery

Run the full five-command gate once more, confirm local HEAD equals remote
`next-migration`, and report:

- implemented project workflows;
- live migration versions and advisor outcome;
- 51-plus test-file and exact test totals;
- build result and preview URL;
- smoke result or exact reason it remains pending;
- unrelated working-tree files intentionally left untouched.
