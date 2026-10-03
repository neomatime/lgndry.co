# Follow-ups Module Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-30-follow-ups-module-design.md`  
**Branch:** `next-migration`  
**Database:** live Supabase project `tscaluhtfrvwlwjybfsg`  
**Delivery:** additive migration, tested locally and in a rolled-back live transaction before apply

## Codebase Findings

- OPS authentication resolves `{ id, email, name }` through `requireOpsUser()` and the existing
  `admin_users` membership check. There is no staff/profile or assignment model.
- Clients already expose normalized `client_contacts`; Projects use `projects.client` as the client
  foreign key and `projects.client_contact_id` for an optional contact; Enquiries use
  `enquiries.client_id` and do not yet carry a normalized contact id.
- `ops_activity_log` supports `message`, `collection`, `record_id`, `action`, and `created_at`, but
  does not store an actor. Follow-ups therefore retain creator identity and display snapshots on
  their own record while using the existing activity shape.
- Client, Enquiry, and Project detail fetches already use cached server-only result contracts and
  scoped activity queries. Their view models can be extended without introducing a second data
  access pattern.
- The new tables must receive explicit grants because Supabase is transitioning public-schema
  tables away from automatic Data API exposure. RLS and grants are both required.
- The latest relevant Supabase guidance still requires explicit function execute revocation and
  warns that `SECURITY DEFINER` bypasses RLS. Every callable function will therefore independently
  verify `is_admin((select auth.uid()))`, use an empty search path, and expose only the minimum
  authenticated execute grants.

## Locked Technical Decisions

### Tables

Create three additive tables:

1. `follow_up_series`
   - `id uuid` primary key.
   - Required client and optional contact/enquiry/project foreign keys.
   - Series template fields: type, custom type, title, overview, notes, priority, contact methods,
     due time, and checklist label array.
   - Normalized recurrence fields plus an RFC recurrence string generated and interpreted by the
     application: frequency, interval, weekdays, month anchor, end date, maximum occurrences,
     occurrences created, and active state.
   - Creator id/name/email snapshots and timestamps.
2. `follow_ups`
   - UUID primary key plus identity `reference_number`, rendered as `FUP-` with a padded number.
   - Required `client_id`; optional `contact_id`; optional `enquiry_id` or `project_id`, with a
     database check allowing at most one primary related record.
   - Type/custom type, title, overview, notes, due date/time, priority, contact methods.
   - Persisted lifecycle state `Open | Completed | Cancelled` and corresponding outcome/reason/time.
   - Creator/owner id plus immutable name/email snapshots. The auth-user foreign key uses
     `ON DELETE SET NULL` so historical work remains readable.
   - Optional series id, occurrence number, successor id, optimistic `version`, and timestamps.
   - Unique `(series_id, occurrence_number)` for recurring records.
3. `follow_up_checklist_items`
   - Follow-up foreign key, label, stable sort order, completion flag/time/user, version, and
     timestamps.

All tables enable RLS. `anon` receives no privileges. `authenticated` receives select only and an
admin-select policy; all writes go through narrow RPCs. `service_role` retains required access.
Indexes cover client, contact, enquiry, project, owner, due date/state, series/occurrence, and
checklist ordering.

### Recurrence engine

- Add the mature `rrule` package at the exact registry version resolved during implementation and
  commit the lockfile. Use UTC date components as floating Johannesburg-local dates; due time is
  stored separately and never shifted through browser time zones.
- Keep recurrence parsing/calculation in a pure `recurrence.ts` module with exhaustive tests for
  daily, selected-weekday weekly, monthly, custom intervals, end dates, counts, and month-end
  behavior.
- Store normalized recurrence fields as the authoritative editable representation and an RRULE
  string for deterministic reconstruction/debugging.
- The server computes the candidate successor date. The completion/cancellation RPC locks the
  current record and series, rechecks state/count/end constraints, validates that the candidate is
  later than the current occurrence, and creates the successor in the same transaction.
- A unique occurrence constraint plus `successor_id` makes repeated completion/cancellation calls
  idempotent.
- A recurring occurrence with an existing successor cannot be reopened. Standalone follow-ups and
  a terminal series occurrence may be reopened. This preserves the one-current-occurrence model
  without deleting or silently cancelling work already created.

### Mutation boundary

Create admin-gated functions with JSONB result contracts:

- `create_follow_up(jsonb, jsonb, jsonb)`
- `update_follow_up(uuid, jsonb, jsonb, text, integer)`
- `set_follow_up_checklist_item(uuid, boolean, integer)`
- `reschedule_follow_up(uuid, date, time, text, integer)`
- `complete_follow_up(uuid, text, date, integer)`
- `cancel_follow_up(uuid, text, text, date, integer)`
- `reopen_follow_up(uuid, integer)`

Every function validates relationship ownership, locks mutable rows, checks optimistic version,
writes follow-up-scoped activity, and returns `ok`, `not-found`, `conflict`, or `invalid`. Creation
sets owner identity from `auth.uid()` and the server-provided display snapshots only after the
function verifies the caller is an admin. Checklist replacement, series-template updates, lifecycle
changes, and successor creation remain atomic.

## Task 1: Migration And SQL Contracts

**Create**

- `supabase/migrations/<generated>_follow_ups_module.sql`
- `src/features/follow-ups/migration-sql.test.ts`

**Steps**

1. Run `supabase --help`, `supabase migration --help`, and
   `supabase migration new follow_ups_module`; use the generated filename.
2. Write failing SQL-contract tests for tables, constraints, RLS, grants, indexes, admin checks,
   activity attribution, optimistic locking, and recurrence idempotency.
3. Implement tables, helper functions, and the seven public RPCs.
4. Explicitly revoke table privileges and function execution from `public`, `anon`,
   `authenticated`, and `service_role`, then grant only the intended select/execute privileges.
5. Assert all relationship checks in SQL: selected contact/enquiry/project belongs to the selected
   client, archived clients cannot receive new work, and at most one enquiry/project is selected.
6. Run the full gate before proceeding.

## Task 2: Domain Types, Validation, And Scheduling

**Create**

- `src/features/follow-ups/types.ts`
- `src/features/follow-ups/schemas.ts`
- `src/features/follow-ups/schemas.test.ts`
- `src/features/follow-ups/recurrence.ts`
- `src/features/follow-ups/recurrence.test.ts`
- `src/features/follow-ups/list-view-model.ts`
- `src/features/follow-ups/list-view-model.test.ts`
- `src/features/follow-ups/detail-view-model.ts`
- `src/features/follow-ups/detail-view-model.test.ts`

**Modify**

- `package.json`
- `pnpm-lock.yaml`

**Steps**

1. Resolve and add an exact `rrule` version with pnpm.
2. Define the approved fixed types, priorities, contact methods, lifecycle states, computed schedule
   states, recurrence inputs, checklist inputs, owner snapshots, filters, sorts, and action results.
3. Build Zod schemas with conditional custom-type, cancellation, recurrence, and edit-scope rules.
4. Implement pure Johannesburg scheduling helpers. Untimed items become overdue after their due
   date; timed items become overdue after their local due time.
5. Implement RRULE creation and one-successor calculation without relying on the machine timezone.
6. Shape database records separately from filtering/sorting and UI.
7. Test all boundary dates, recurrence limits, searches, filters, sorting, summary metrics, and
   malformed records.
8. Run the full gate.

## Task 3: Server Reads And Form Options

**Create**

- `src/features/follow-ups/fetch-follow-ups.ts`
- `src/features/follow-ups/fetch-follow-ups.test.ts`
- `src/features/follow-ups/fetch-follow-up-detail.ts`
- `src/features/follow-ups/fetch-follow-up-detail.test.ts`
- `src/features/follow-ups/fetch-follow-up-form-data.ts`
- `src/features/follow-ups/fetch-follow-up-form-data.test.ts`
- `src/features/follow-ups/fetch-related-follow-ups.ts`
- `src/features/follow-ups/fetch-related-follow-ups.test.ts`

**Steps**

1. Fetch list records with client, optional contact, optional related-record labels, owner snapshots,
   checklist progress, and scoped activity.
2. Fetch detail with checklist, series summary, predecessor/successor context, linked records, and
   activity.
3. Fetch non-archived clients and their contacts, enquiries, and projects for the shared form.
   Related options are filtered by selected client in the view model and validated again on write.
4. Add a small related-record fetch for Client, Enquiry, and Project detail integration.
5. Follow the existing null/result contracts, `console.error` logging, UUID validation, and React
   `cache()` conventions.
6. Run the full gate.

## Task 4: Server Actions And Lifecycle Tests

**Create**

- `src/features/follow-ups/actions.ts`
- `src/features/follow-ups/actions.test.ts`

**Steps**

1. Authenticate with `requireOpsUser()` before parsing or database access.
2. Normalize validated input into the RPC payloads, including owner display snapshots on create.
3. Compute successor dates with the pure recurrence module before calling complete or skip-current
   cancellation RPCs.
4. Map RPC JSONB results into calm typed outcomes, including edit conflicts and the existing record
   link for relation conflicts.
5. Revalidate list, detail, edit, and related Client/Enquiry/Project paths after each mutation.
6. Test auth ordering, validation, RPC payloads, recurrence candidates, conflicts, thrown errors,
   and every revalidation path.
7. Run the full gate.

## Task 5: Shared Form And Create/Edit Routes

**Create**

- `src/features/follow-ups/components/follow-up-form.tsx`
- `src/features/follow-ups/components/follow-up-form.test.tsx`
- `src/features/follow-ups/components/checklist-editor.tsx`
- `src/features/follow-ups/components/checklist-editor.test.tsx`
- `src/features/follow-ups/components/recurrence-editor.tsx`
- `src/features/follow-ups/components/recurrence-editor.test.tsx`
- `src/app/(app)/ops/follow-ups/new/page.tsx`
- `src/app/(app)/ops/follow-ups/new/page.test.tsx`
- `src/app/(app)/ops/follow-ups/[id]/edit/page.tsx`
- `src/app/(app)/ops/follow-ups/[id]/edit/page.test.tsx`

**Steps**

1. Build one controlled form for global/contextual creation and editing.
2. Client selection clears incompatible contact and related-record selections; enquiry/project
   controls contain only records belonging to the selected client.
3. Provide multi-select contact methods, ordered checklist editing, and recurrence controls for
   daily, weekly, monthly, and custom intervals with end-date/count choices.
4. Context query parameters preselect client/contact/enquiry/project only after server-side
   validation. Invalid combinations render a calm form-level message rather than trusting the URL.
5. Recurring edits ask for `This occurrence only` or `This and future occurrences`. Occurrence-only
   edits cannot alter the recurrence rule.
6. Preserve values and field errors after failed submissions; redirect successful saves to detail.
7. Test keyboard behavior, conditional fields, scoped options, recurrence, validation, success,
   conflicts, and failure messaging.
8. Run the full gate.

## Task 6: Follow-ups List

**Create**

- `src/app/(app)/ops/follow-ups/page.tsx`
- `src/app/(app)/ops/follow-ups/page.test.tsx`
- `src/features/follow-ups/components/follow-ups-table.tsx`
- `src/features/follow-ups/components/follow-ups-table.test.tsx`
- `src/features/follow-ups/components/follow-up-badges.tsx`
- `src/features/follow-ups/components/follow-up-preview.tsx`

**Steps**

1. Add the page header, New Follow-up action, four factual stat cards, schedule-state tabs, search,
   filters, and sort controls from the approved reference.
2. Render a full-width desktop table with real record links and checkbox-selected inline preview.
3. Render a compact stacked mobile list and progressively hide secondary desktop columns so the
   module introduces no visible nested horizontal scrollbar.
4. Add distinct empty and temporarily unavailable states.
5. Test metric accuracy, filters, search, sort, selection, semantic navigation, responsive class
   contracts, and date formatting with Johannesburg explicitly set.
6. Run the full gate.

## Task 7: Detail And Lifecycle Controls

**Create**

- `src/app/(app)/ops/follow-ups/[id]/page.tsx`
- `src/app/(app)/ops/follow-ups/[id]/page.test.tsx`
- `src/features/follow-ups/components/follow-up-detail.tsx`
- `src/features/follow-ups/components/follow-up-detail.test.tsx`
- `src/features/follow-ups/components/follow-up-checklist.tsx`
- `src/features/follow-ups/components/follow-up-checklist.test.tsx`
- `src/features/follow-ups/components/follow-up-lifecycle-control.tsx`
- `src/features/follow-ups/components/follow-up-lifecycle-control.test.tsx`

**Steps**

1. Build summary cards, Overview/Checklist/History tabs, linked-record rail, optional contact details,
   recurrence summary, and scoped activity.
2. Add accessible checklist toggles with optimistic-version conflict handling.
3. Add Mark Complete, Reschedule, Cancel, and Reopen controls with focus-managed confirmation
   dialogs and required/optional notes from the spec.
4. Warn before completing with unfinished checklist items.
5. For recurring work, show the created successor after completion or skip-current cancellation;
   cancel-future ends the series. Prevent reopening when a successor already exists.
6. Validate malformed IDs before data access and preserve distinct 404/unavailable states in both
   page and metadata paths.
7. Run the full gate.

## Task 8: Client, Enquiry, Project, And Navigation Integration

**Create**

- `src/features/follow-ups/components/related-follow-ups.tsx`
- `src/features/follow-ups/components/related-follow-ups.test.tsx`

**Modify**

- `src/components/layout/ops-nav.tsx`
- `src/components/layout/ops-nav.test.tsx`
- `src/features/clients/fetch-client-detail.ts`
- `src/features/clients/fetch-client-detail.test.ts`
- `src/features/clients/detail-view-model.ts`
- `src/features/clients/detail-view-model.test.ts`
- `src/features/clients/components/client-detail.tsx`
- `src/features/projects/fetch-project-detail.ts`
- `src/features/projects/fetch-project-detail.test.ts`
- `src/features/projects/detail-view-model.ts`
- `src/features/projects/detail-view-model.test.ts`
- `src/features/projects/types.ts`
- `src/features/projects/components/project-detail.tsx`
- `src/features/enquiries/fetch-enquiry-detail.ts`
- `src/features/enquiries/fetch-enquiry-detail.test.ts`
- `src/features/enquiries/detail-view-model.ts`
- `src/features/enquiries/detail-view-model.test.ts`
- `src/features/enquiries/components/enquiry-detail-tabs.tsx`
- `src/app/(app)/ops/enquiries/[id]/page.tsx`

**Steps**

1. Enable Follow-ups in the sidebar without changing the approved navigation order.
2. Add contextual Add Follow-up links with safe preselection query parameters.
3. Add linked follow-up sections to Client and Project details.
4. Activate the Enquiry Follow-ups tab and list enquiry-linked records there.
5. Keep all related displays backed by shared follow-up types/view models/components.
6. Test unavailable child queries as parent-page failures, active/terminal grouping, links, empty
   states, archived-record behavior, and route preselection.
7. Run the full gate.

## Task 9: Whole-Feature Review, Live Verification, And Release

**Modify**

- `docs/architecture/application-architecture.md`
- The spec or plan only if implementation review identifies and records a deliberate deviation.

**Steps**

1. Compare every shipped behavior back to the approved spec and both design references.
2. Review all SQL and client queries for accidental anon grants, missing RLS, silent zero-row
   assumptions, relationship mismatches, and recurrence duplicate creation.
3. Inspect `git diff --check` and stage only named Follow-ups files. Never stage unrelated images,
   OAuth material, owner scope docs, inbox reference, `supabase/.temp`, or verification files.
4. Run the complete migration against the live schema in a transaction that always rolls back.
   Assert table/function/ACL shape, admin and non-admin behavior, zero-row RLS denial, CRUD,
   relationship validation, checklist history, optimistic conflicts, standalone lifecycle,
   recurring completion, skip-current cancellation, cancel-future, idempotent retry, and cleanup.
5. Run the full repository gate:

   ```text
   pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```

6. Apply the reviewed migration only after rolled-back verification passes; then inspect database
   and security advisors and run post-apply read-only checks.
7. With explicit user approval before any temporary live rows, run an authenticated browser smoke
   test covering global and contextual creation, edit, checklist, recurrence, lifecycle actions,
   linked-record views, malformed-id 404, and cleanup.
8. Commit only named files, push `next-migration`, and confirm the Vercel deployment status.

## Planned Deliberate Deviations From The Mockups

- No Export action in the first release.
- No Communication tab or message snapshot until Inbox/Communications ships.
- No team assignment or supporting-team UI; creator ownership is automatic.
- No invoice relation until Invoices ships.
- No destructive delete action.
- No trend arrows unsupported by historical aggregates.
- Responsive layouts avoid the visible nested horizontal scrollbars present in earlier modules.

## Definition Of Done

- Every acceptance criterion in the approved spec is implemented or documented as an approved
  deviation.
- Full gate passes after every task and at the end.
- Live migration verification and post-apply inspection pass without leaving synthetic rows.
- Follow-ups is active in navigation and linked views are functional in Clients, Enquiries, and
  Projects.
- Vercel reports a successful deployment for the pushed commit.
