# Projects Module - Design Spec

Sub-project 5 of the OPS Command Center rebuild. Sub-projects 1-4 delivered
the enquiry pipeline, direct signed uploads, styled Enquiries pages, and the
read/write Clients module. This sub-project turns the legacy `projects` table
into a lightweight production workspace with an active kanban, structured
project plans, enquiry conversion, and complete project records.

Governing references:

- `docs/LGNDRY_Command_Center_Refinement_Scope.md`
- `docs/design-references/projects-kanban.png`
- `docs/design-references/view-project.png`
- `docs/architecture/application-architecture.md`

The reference images are the visual target. Panels that depend on Inbox,
Invoices, Settings, or a project-file pipeline are deferred until those systems
exist. The module must feel like a focused production cockpit, not an enterprise
project-management suite.

## Product decisions

The owner approved these decisions during the 2026-09-29 design session:

- The active kanban has five ordered stages: `Planning`, `Pre-Production`,
  `Production`, `Review`, and `Delivery`.
- Projects leaving the active board use one of three searchable outcomes:
  `Completed`, `On Hold`, or `Cancelled`.
- Milestones, tasks, and deliverables are structured, ordered, editable records.
- Files, communications, and full finance functionality remain deferred to their
  own backing modules.
- People and resources are optional free-text production notes until Settings
  supplies a real staff/team model. No fake owner dropdown is introduced.
- The initial financial snapshot contains budget minimum, budget maximum,
  currency, and payment status only.
  - Payment status: `Not Invoiced`, `Deposit Pending`, `Partially Paid`, `Paid`
- Delivery state is distinct from production stage.
  - Delivery status: `Not Ready`, `Ready for Delivery`, `Delivered`
- Scheduling uses start and end dates, allows same-day projects, and retains
  optional free-text schedule notes.
- UUIDs stay internal. No generated `PRJ-0001`-style reference is added.
- Projects can be archived and restored but never permanently deleted in the UI.
  `Completed` is a normal lifecycle outcome, not an archive state.
- Every project requires a client. A project may select one linked contact from
  that client and defaults to the client's primary contact.
- An enquiry can create at most one project. Conversion is allowed from any open
  enquiry (`New` through `Booked`), sets it to `Booked`, and is blocked for
  `Completed` or `Closed` enquiries.
- Linked enquiry status stays synchronized when its project enters `Production`
  or `Completed`.
- Existing booking links are preserved and rendered as read-only snapshots.
- Kanban stage changes support drag-and-drop and an accessible Change stage menu.
- Client previews and details gain linked Projects as part of this release.
- Activity covers creation, enquiry conversion, profile edits, stage changes,
  task and deliverable completion, archive, and restore. Conversion also writes
  an event to the source enquiry.
- Project type is controlled: `Documentary`, `Event`, `Film`,
  `Visual Production`, or `Other`. Scope/services are ordered free-text tags.

## Scope boundary

### In scope

- `/ops/projects` with production summary counts, active-stage kanban, terminal
  outcome views, search, filters, sorting, and an inline project preview.
- `/ops/projects/new` for standalone project creation.
- `/ops/projects/new?enquiry=<uuid>` for enquiry conversion with prefilled
  client, contact, type, overview, location, dates/notes, and budget where the
  source data can be mapped safely.
- `/ops/projects/[id]` with project overview, production plan, linked records,
  lightweight financial/delivery snapshots, and activity.
- `/ops/projects/[id]/edit` for the project profile and structured plan.
- Drag-and-drop and menu-driven stage changes.
- Structured milestones, tasks, and deliverables with ordering and completion.
- Archive and restore actions, with no hard-delete action.
- Enquiry-to-project creation and lifecycle synchronization.
- Read-only compatibility display for a linked legacy booking.
- Linked project summaries on Clients list previews and detail pages.
- Enabling Projects in the OPS sidebar when the module ships.

### Explicitly out of scope

- Staff ownership, assignee records, capacity planning, or time tracking.
- File upload, asset review, or delivery links.
- Inbox messages or a communication timeline.
- Invoice line items, quotes, payments, balances, or accounting calculations.
- Booking creation or editing.
- Project templates, recurring projects, dependencies, or Gantt charts.
- Client-facing project access.
- Bulk actions, exports, or permanent deletion.
- Automatic parsing of arbitrary legacy timeline or budget prose.

## Existing data and compatibility

The live `projects` table has one row and these columns: `id`, `archived`,
`name`, `image`, `client`, `booking`, `type`, `brief`, `moodboard`, `shotList`,
`deliverables`, `timeline`, `tasks`, `files`, `comments`, `status`,
`created_at`, and `updated_at`. It already references `clients.id` and
`bookings.id`. The table, UUID, existing foreign keys, and legacy text columns
remain in place.

The live row is linked to a booking and stores newline-delimited tasks plus a
free-text timeline. Migration must preserve every value. The new structured
tables are populated conservatively:

- each non-empty line in legacy `tasks` becomes an ordered incomplete task;
- each non-empty line in legacy `deliverables` becomes an ordered deliverable;
- legacy `timeline` remains the schedule-notes value;
- a linked booking date and location may backfill missing structured project
  dates and location;
- unknown legacy `type` values map to `Other` in the new controlled field;
- the client contact defaults to that client's active primary contact;
- no prose is guessed into milestones, budget numbers, or terminal statuses.

New OPS writes keep the useful legacy mirrors (`type`, `brief`, `timeline`,
`tasks`, and `deliverables`) current so the legacy admin remains readable until
production cutover. Other legacy text/file columns are preserved but not
surfaced as editable fields in this release.

## Data model

### Additions to `projects`

| Column | Type | Default / rules | Purpose |
| --- | --- | --- | --- |
| `enquiry_id` | uuid, nullable | unique FK to `enquiries.id`, set null on database-only deletion | Source enquiry and one-project-per-enquiry rule |
| `client_contact_id` | uuid, nullable | FK to `client_contacts.id`, set null on deletion | Current project contact |
| `project_type` | text | `Other`; controlled check | Stable project classification |
| `services` | text[] | empty array | Ordered free-text scope labels |
| `location` | text, nullable | | Production location |
| `start_date` | date, nullable | must be before or equal to end date | Structured schedule |
| `end_date` | date, nullable | must be after or equal to start date | Structured schedule |
| `people_resources` | text, nullable | | Crew, equipment, travel, and venue notes |
| `budget_min` | numeric(12,2), nullable | non-negative; not above max | Lightweight budget range |
| `budget_max` | numeric(12,2), nullable | non-negative; not below min | Lightweight budget range |
| `currency` | text | `ZAR`; three uppercase letters | Display currency |
| `payment_status` | text | `Not Invoiced`; controlled check | Temporary finance snapshot |
| `delivery_status` | text | `Not Ready`; controlled check | Actual delivery state |
| `stage_position` | integer | generated placement within stage | Stable kanban ordering |

`projects.status` receives a check constraint for all eight approved lifecycle
values. `projects.archived` remains the archive source of truth. Project name,
client, project type, and status are required for new OPS writes. Existing rows
must pass a migration preflight before any stronger constraint is applied.

The selected contact must belong to the selected client and must be active.
That relationship is checked again inside database write functions rather than
trusted to form validation.

Indexes cover active status/position ordering, client, client contact, enquiry,
start date, and booking foreign keys. Existing foreign-key columns that lack an
index receive one.

### `project_milestones`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, generated |
| `project_id` | uuid | required FK to projects, cascade on database-only deletion |
| `title` | text | required |
| `description` | text, nullable | optional production context |
| `due_date` | date, nullable | optional |
| `status` | text | `Pending` or `Completed` |
| `sort_order` | integer | required, unique per project |
| `completed_at` | timestamptz, nullable | set only when completed |
| `created_at`, `updated_at` | timestamptz | standard timestamps |

### `project_tasks`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, generated |
| `project_id` | uuid | required FK to projects, cascade on database-only deletion |
| `title` | text | required |
| `due_date` | date, nullable | optional |
| `is_completed` | boolean | default false |
| `sort_order` | integer | required, unique per project |
| `completed_at` | timestamptz, nullable | set with completion |
| `created_at`, `updated_at` | timestamptz | standard timestamps |

### `project_deliverables`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, generated |
| `project_id` | uuid | required FK to projects, cascade on database-only deletion |
| `title` | text | required |
| `due_date` | date, nullable | optional |
| `status` | text | `Not Started`, `In Progress`, `Ready`, or `Delivered` |
| `sort_order` | integer | required, unique per project |
| `completed_at` | timestamptz, nullable | set for `Delivered` |
| `created_at`, `updated_at` | timestamptz | standard timestamps |

All three tables use admin-only RLS with `is_admin((select auth.uid()))` and
updated-at triggers. All function execution grants must account for this
project's direct API-role default grants: revoke from `PUBLIC`, `anon`,
`authenticated`, and `service_role`, then grant back only the intended roles.

### Enquiry relationship

`projects.enquiry_id` is the single canonical relationship. Its unique
constraint prevents duplicate conversion, and its index supports the enquiry
detail lookup. The Enquiries UI queries the project by `enquiry_id`; no
reciprocal `enquiries.project_id` column is added, avoiding two foreign keys
that could drift out of sync.

## Write operations

Server Actions call `requireOpsUser()` before all data access, validate with
shared Zod schemas, and call admin-gated `SECURITY DEFINER` functions for
multi-table writes. Each function independently checks
`is_admin((select auth.uid()))`, uses an empty `search_path`, schema-qualifies
objects, and returns typed success, not-found, conflict, or validation results.

### Create and convert

`create_project_with_plan(project_payload, milestones, tasks, deliverables)`:

- validates client/contact ownership, lifecycle values, dates, budget range,
  and structured child records;
- inserts the project and ordered plan records atomically;
- mirrors structured values into the relevant legacy text columns;
- records a project `created` activity entry;
- returns the new project id for redirect.

`convert_enquiry_to_project(enquiry_id, project_payload, ...)`:

- locks the enquiry and rejects archived, `Completed`, `Closed`, or already
  converted records;
- requires its linked active client and validates the chosen client contact;
- creates the project and structured plan in the same transaction;
- stores the source relationship and changes the enquiry to `Booked`;
- records `converted` activity against both project and enquiry;
- never overwrites the saved client or contact profile.

The conversion page uses enquiry values only as editable defaults. Free-text
budget and timeline values are shown for reference when they cannot be parsed
without guessing.

### Edit

`update_project_with_plan(project_id, project_payload, ...)` locks the active
project, validates the full payload, updates its profile, and reconciles the
three ordered child sets atomically. Removed child rows are deleted. Existing
child ids must belong to the project. The function updates legacy mirrors and
records one project `updated` activity entry.

### Stage movement and status synchronization

`move_project(project_id, status, stage_position)` handles both drag-and-drop
and the Change stage menu. It locks the affected active projects, assigns the
new lifecycle status and stable position, and compacts ordering in the source
and destination stages.

When a linked project enters `Production`, the source enquiry becomes
`In Production`. When it enters `Completed`, the enquiry becomes `Completed`.
Moving backward or into `On Hold`, `Cancelled`, or another active stage does
not reopen or downgrade a source enquiry automatically. Every change records a
project activity entry; synchronized enquiry changes record an enquiry event.

### Quick completion actions

Milestone completion, task completion, and deliverable status changes use
narrow admin-gated functions instead of sending the whole edit form. Each
action updates completion time, updates the relevant legacy text mirror where
one exists, and records activity.

Delivery state is explicit. Completing all deliverables does not silently mark
the project `Ready for Delivery`, and setting the project to `Completed` does
not silently mark undelivered items delivered.

### Archive and restore

`set_project_archived(project_id, archived)` archives or restores the project
without deleting plan records, client links, enquiry links, or booking links.
Restore returns the project to its stored lifecycle state and appends it to the
end of that view's ordering. Both actions write project activity.

## `/ops/projects` page

### Header and summaries

The page title is `Projects` with restrained supporting copy. Actions are
`New Project`; export remains out of scope. Four derived summary cards show:

- Active Projects: all non-archived projects in the five kanban stages.
- In Production: active `Production` projects.
- Awaiting Approval: active `Review` projects.
- Ready for Delivery: active projects with delivery status
  `Ready for Delivery`.

Counts are factual totals without invented trend language.

### Views, filters, and search

The default `Active` view renders the five-stage board. Additional views show
`Completed`, `On Hold`, `Cancelled`, and `Archived` projects in a compact table
because terminal records do not need empty five-column boards.

Search matches project name, client name, contact name/email, project type,
service tags, location, and overview. Filters cover client, project type,
payment status, delivery status, and date range. Sort options are board order,
newest, oldest, start date, and project name. Current volume remains small, so
filtering and sorting are client-side with no pagination.

### Kanban cards and movement

Each active card shows project name, client, type, next incomplete task, start
date, payment status, deliverables progress, and optional contact initials. The
entire card is not a disguised link: its project name is a real `<Link>`, and
the card menu contains explicit commands.

Cards can be dragged between active columns and reordered within a column. The
same transitions are available from a keyboard-accessible Change stage menu.
Optimistic movement must roll back visibly if persistence fails. Mobile uses a
horizontally scrollable, snap-aligned board with stable column widths; the menu
path remains the primary touch fallback.

Use `@dnd-kit/core` and `@dnd-kit/sortable` for pointer, touch, and keyboard
drag behavior rather than implementing collision detection and accessibility
semantics from scratch.

Selecting one checkbox opens the inline preview used by Enquiries and Clients.
It shows profile details, next actions, deliverable progress, linked enquiry or
booking, and recent project activity. It never replaces the full detail page.

## `/ops/projects/[id]` page

Malformed UUIDs and missing/archived records return 404 unless the archived
view links to a valid archived detail. Fetch results distinguish not-found from
temporary database failure.

The header shows project name, client link, lifecycle badge, Change stage, Edit,
and Archive/Restore actions. Summary cards show current stage, payment status,
date range, budget, and deliverable progress.

Tabs:

- Overview: overview/brief, services, schedule, people/resources, client and
  selected contact, delivery state, source enquiry, and booking snapshot.
- Plan: ordered milestones, tasks, and deliverables, with quick task and
  deliverable status controls.
- Activity: project-filtered `ops_activity_log` entries.

The right rail contains project/client/contact details, next actions,
deliverable progress, the lightweight budget/payment snapshot, and linked
record shortcuts. Communication, Files, and Finance tabs are absent until their
systems ship; no empty placeholder tabs are rendered.

## Create and edit pages

Create and edit use full pages and the same controlled form. Sections are:

- Project profile: name, client, project contact, type, services, overview.
- Schedule: location, start/end dates, schedule notes.
- Production: stage, delivery status, people/resources.
- Financial snapshot: budget range, currency, payment status.
- Plan: repeatable, reorderable milestones, tasks, and deliverables.

Changing client resets an incompatible selected contact and loads that client's
active contacts. Exactly one client is required; contact is optional if no
active contact exists. Client/contact pickers are searchable without creating
new clients inline.

The enquiry-conversion variant clearly links back to its source, shows
unparsed source timeline/budget text beside the relevant fields, and requires a
confirmation that submission will mark the enquiry Booked.

Validation errors render a focused summary with links to fields plus inline
messages. Duplicate conversion returns a link to the existing project. Unknown
or stale child ids fail without partial writes.

## Client and enquiry integration

Client list data includes linked project counts and recent project summaries.
The selected-client preview gains recent Projects after Enquiries. Client detail
gains a Projects section showing project name, lifecycle stage, date range,
delivery status, and a real detail link.

Enquiry detail gains a Create Project action for eligible records and an Open
Project link after conversion. This does not add general enquiry editing,
qualification, ownership, or other deferred write flows.

## Error, accessibility, and responsive behavior

- Server-only fetches follow the established `{ status: "ok" | "not-found" |
  "error" }` or nullable-result conventions, never throw, and log failures.
- Pages render distinct temporary-unavailability states; the route error
  boundary remains reserved for uncaught exceptions.
- Pages and `generateMetadata` call `requireOpsUser()` before data access and
  share cached dynamic-detail fetches.
- Drag-and-drop is never the only way to change a stage.
- Board columns, cards, progress bars, form repeaters, and action controls use
  stable responsive dimensions with no content-driven layout shifts.
- Status is never conveyed by color alone. The monochrome design tokens remain
  the only palette.
- Dates in client components specify `Africa/Johannesburg` explicitly.
- Reduced-motion preferences remove animated card travel while preserving state
  changes.
- Loading, empty, no-results, success, validation, conflict, and persistence-
  failure states are all explicit.

## Testing

### Database migration verification

Run the complete migration in one rolled-back transaction against the live
schema and assert row counts, not only errors:

- the existing project id, client, booking, and every legacy field are
  preserved;
- legacy tasks/deliverables are backfilled once and in source order;
- booking data only fills missing structured schedule/location fields;
- contact backfill links only to the project's client;
- every new FK has an index and every table has admin-only RLS;
- anon and non-admin users cannot read or write project data;
- admin users can read and use every intended write function;
- API role function grants match the intended matrix exactly;
- client/contact mismatch, invalid dates/budgets, bad child ids, duplicate
  conversion, and terminal enquiry conversion are rejected atomically;
- create, edit, move/reorder, quick completion, archive, and restore preserve
  all invariants and write activity;
- linked enquiry status synchronization follows the approved one-way rules;
- no test row survives rollback.

After applying, inspect columns, constraints, indexes, policies, function ACLs,
backfill counts, duplicate links, primary contacts, and both Supabase advisor
reports. Any temporary live data requires explicit owner approval and cleanup.

### Unit and fetch tests

- Lifecycle, payment, delivery, milestone, and deliverable parsers.
- Form schema including dates, budget range, client/contact ownership result,
  and structured plan rules.
- Board shaping, ordering, filters, summaries, progress, next action, and search.
- Legacy mirror serialization and conservative backfill helpers where pure code
  exists.
- Project list/detail/form-options fetch success, not-found, malformed id, and
  database failure.
- Conversion-prefill mapping with parseable and unparseable source values.
- Client and enquiry integration view models.
- Every Server Action result, authorization call, redirect, conflict, and
  revalidation path.

### Component and route tests

- Five active columns, terminal views, summary cards, filters, search, sort,
  links, selection preview, and empty states.
- Drag persistence, rollback on failure, and equivalent menu stage changes.
- Detail tabs, quick completion controls, booking/enquiry links, and archive
  confirmation.
- Create/edit repeaters, reordering, client/contact reset, validation summary,
  conflict links, and conversion confirmation.
- Client previews/details render project links; enquiry details render Create or
  Open Project correctly.
- Projects nav availability and active state.

### Required verification

Run the full repository gate after every implementation task and once more for
the completed module:

```text
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

After deployment and explicit approval for temporary live records, run a browser
smoke test that converts an enquiry, moves and reorders the project, edits its
plan, completes a task and deliverable, checks client/enquiry links and activity,
archives/restores it, and deletes all temporary rows afterward.

## Documentation and delivery

Record final schema choices, grant behavior, compatibility decisions, deliberate
mockup deviations, live verification, and remaining deferred panels in
`docs/architecture/application-architecture.md`. Update the Projects nav item
only when list, create, detail, edit, and conversion paths all ship. Stage files
by name, keep unrelated working-tree files untouched, commit in small reviewed
tasks, and push `next-migration` without merging or opening a pull request.
