# Follow-ups Module Design

**Date:** 2026-09-30  
**Status:** Implemented (see docs/architecture/application-architecture.md, sub-project 7)  
**Branch:** `next-migration`

## Summary

Build the first complete Follow-ups module for the OPS Command Center. Follow-ups are
internal, scheduled actions anchored to a client and optionally related to an enquiry or
project. The module provides a focused work queue for due, overdue, upcoming, completed,
and cancelled actions while preserving a reliable activity history.

The first release includes creation, editing, recurrence, checklists, completion,
cancellation, rescheduling, filtering, sorting, detail views, and contextual entry points
from Clients, Enquiries, and Projects. Notifications remain in-app only. Email, WhatsApp,
and broader communications functionality are deferred.

## Goals

- Give OPS users one reliable place to see what needs attention next.
- Make due and overdue work immediately visible without storing fragile derived statuses.
- Link every follow-up to a client and optionally to the enquiry or project that created the
  need for action.
- Support recurring operational work without filling the database with future occurrences.
- Preserve completion, cancellation, checklist, recurrence, and edit history.
- Make follow-up creation fast from both the module and related record detail pages.
- Match the monochrome OPS design system and established server/data/view-model boundaries.

## Non-goals

- Email notifications or outbound email delivery.
- WhatsApp Business Platform integration or automated WhatsApp messages.
- Communications inbox, message synchronization, or delivery receipts.
- Invoice links before the Invoices module ships.
- Team assignment, reassignment, workload balancing, or supporting-team membership.
- Permanent deletion of follow-ups.
- A background scheduler that materializes an entire recurring series.
- Command Center dashboard summaries, which remain deferred until all source modules exist.

## Core Record Model

### Follow-up

Each follow-up stores:

- A generated public reference such as `FUP-0312`.
- A required client.
- An optional contact belonging to that client.
- An optional enquiry or project relation. A follow-up has at most one primary related record.
- A required type.
- An optional custom type label when the type is `Other`.
- A required title or next action.
- Optional overview and internal notes.
- A required due date and optional due time.
- Priority: Low, Medium, or High.
- One or more intended contact methods.
- Lifecycle state: Open, Completed, or Cancelled.
- Creator/owner, automatically set to the authenticated OPS user who creates the record.
- Completion timestamp and optional completion outcome.
- Cancellation timestamp and required cancellation reason.
- Optional recurrence configuration and recurrence-series identity.
- Created and updated timestamps.

### Follow-up types

The initial fixed choices are:

- Client Check-in
- Quote Follow-up
- Proposal Review
- Deposit Reminder
- Approval
- Delivery Confirmation
- Other

`Other` requires a short custom label. Types are presentation metadata and do not change the
lifecycle rules.

### Contact methods

A follow-up can record multiple intended methods:

- Email
- Phone
- WhatsApp
- Video Call
- In Person

These are planning metadata only. Selecting a method does not send a message or create a
communication record.

### Checklist items

Each follow-up can contain an ordered, editable checklist. Items store their label, sort
position, completion state, completion timestamp, and completing user. Individual items can
be added, edited, reordered, completed, reopened, or removed while the follow-up is Open.

Checklist completion is informative. The overall follow-up may be completed even when some
items remain open, but the completion confirmation must clearly show the outstanding count.

## Status And Scheduling

The persisted lifecycle state is intentionally small:

- **Open:** actionable work.
- **Completed:** finished work, with an optional outcome note.
- **Cancelled:** intentionally abandoned work, with a required reason.

The visible scheduling state is computed from the lifecycle state, due date/time, and the
current time in `Africa/Johannesburg`:

- **Overdue:** Open and due before now.
- **Due Today:** Open and due on the current local date, but not overdue by a supplied time.
- **Upcoming:** Open and due after today.
- **Completed:** persisted Completed state.
- **Cancelled:** persisted Cancelled state.

An all-day follow-up becomes overdue after the end of its due date in Johannesburg. A timed
follow-up becomes overdue immediately after its due time. Computed scheduling labels are not
stored, preventing stale status data.

Completed and Cancelled follow-ups remain visible and cannot be permanently deleted. A standalone
follow-up or terminal series occurrence can be reopened, and the activity log records the
transition. A recurring occurrence that has already created its successor cannot be reopened,
because doing so would create two current actions in one series; the UI explains that conflict and
links to the successor.

## Recurrence

Recurring follow-ups support:

- Daily intervals.
- Weekly intervals, including selected weekdays.
- Monthly intervals.
- Custom intervals expressed as every N days, weeks, or months.
- An optional series end date or maximum occurrence count.

Only the current occurrence exists as an actionable follow-up. Completing the current
occurrence atomically creates the next occurrence when the recurrence rule still applies.
The next occurrence copies the client, related record, type, title, overview, notes, priority,
contact methods, and checklist labels. Checklist completion state and completion outcomes do
not carry forward.

Cancelling a recurring item offers two explicit scopes. **This occurrence only** treats the
occurrence as skipped and atomically creates the next occurrence when the recurrence rule still
applies. **This and future occurrences** cancels the current occurrence and ends the series, so no
successor is created.

Editing a recurring follow-up offers:

- **This occurrence only:** update only the current record.
- **This and future occurrences:** update the series defaults and current record so later
  occurrences inherit the revised values.

Already completed or cancelled occurrences never change when future series defaults are
edited. Recurrence advancement and completion must occur in one database transaction so the
current item cannot complete without its required successor being created.

## Relationships

Every follow-up requires a non-archived client at creation time. It may additionally link to:

- One contact belonging to that client; and
- One enquiry belonging to that client; or
- One project belonging to that client.

The contact and related record remain optional so the follow-up can represent a client-level
or internal action. Client consistency is validated on the server and in the database write
boundary. If the selected contact, enquiry, or project belongs to another client, the write
is rejected with a clear validation message.

Archived clients remain visible on historical follow-ups but cannot be selected for new
follow-ups. If a linked enquiry or project is later archived, the follow-up retains the link
and labels it accordingly.

Invoice relations are added when the Invoices module ships.

## Ownership

The authenticated OPS user who creates a follow-up becomes its owner automatically. The first
release does not expose an assignee picker or reassignment flow. Ownership is retained when a
follow-up is edited, completed, cancelled, reopened, or generates its next occurrence.

The UI displays the owner's name or email-derived fallback. This design leaves room for a
future team assignment system without inventing one prematurely.

## User Experience

### Follow-ups list: `/ops/follow-ups`

The module follows the supplied `follow-ups.png` reference and existing OPS density:

- Page title, concise description, and primary **New Follow-up** action.
- Summary metrics for Due Today, Overdue, Due This Week, and Completed This Week.
- Tabs for All, Due Today, Overdue, Upcoming, Completed, and Cancelled.
- Search across reference, client, title/next action, type, and related-record title.
- Filters for client, type, priority, contact method, and owner scope. Owner scope initially
  contains `Mine` and `All`; all existing records are creator-owned.
- Sort by due date, priority, newest, or oldest.
- A full-width table with reference, client/related item, type, due, priority, scheduling
  status, next action, and owner.
- Real links for the follow-up, client, and related record.
- Row selection opens a lower inline preview inspired by the design reference without making
  table rows themselves clickable.

The list is client-filtered and sorted at the current expected data scale, following the same
approach as Enquiries and Clients. Pagination is deferred until volume requires it.

### Follow-up detail: `/ops/follow-ups/[id]`

The detail page follows `view-follow-up.png` and includes:

- Back navigation, Edit Follow-up, and a primary lifecycle action.
- Summary cards for type, scheduling status, priority, due date/time, owner, and related item.
- Overview, Checklist, and History tabs.
- Contact details from the selected client contact.
- Linked Client and optional Enquiry or Project records.
- Recurrence summary when applicable.
- Activity timeline scoped to the follow-up.

Communication content is deliberately absent until the Communications and Inbox work is
designed. The page must not render a non-functional Communication tab.

### Create and edit

The shared form is available from:

- **New Follow-up** on `/ops/follow-ups`.
- **Add Follow-up** on Client detail.
- **Add Follow-up** on Enquiry detail and its newly active Follow-ups tab.
- **Add Follow-up** on Project detail.

Contextual entry points preselect the client and related record while allowing changes before
save. The global form selects the client first, then limits enquiry and project choices to
that client.

The form contains:

- Client and optional client contact.
- Optional related enquiry or project.
- Type and conditional custom type.
- Title/next action.
- Overview and notes.
- Due date and optional due time.
- Priority.
- Multiple contact methods.
- Editable checklist.
- Optional recurrence controls.

Creation redirects to the new follow-up detail. Editing returns to the detail page with a
calm success message. Validation errors remain attached to their fields and entered values are
preserved.

### Lifecycle actions

- **Mark Complete:** allows an optional outcome note, warns about incomplete checklist items,
  and creates the next recurring occurrence when applicable.
- **Reschedule:** changes due date/time and records the old and new values.
- **Cancel:** requires a short reason and, for recurring work, asks whether to skip this occurrence
  and continue the series or cancel this and all future occurrences.
- **Reopen:** returns eligible Completed or Cancelled records to Open without deleting prior
  outcome or cancellation history. Recurring occurrences with an existing successor remain
  historical and link to that successor instead.

## Enquiry, Client, And Project Integration

- Enquiry Follow-ups tab becomes functional and lists linked follow-ups with an Add action.
- Client detail gains a Follow-ups section or tab listing all client follow-ups.
- Project detail gains a Follow-ups section or tab listing project-linked follow-ups.
- Each integration uses the same server fetch, view-model, status computation, and form rather
  than duplicating module logic.
- Related lists distinguish actionable, completed, and cancelled work and link to detail pages.

## Data And Security

The module uses additive Supabase migrations. Proposed tables are:

- `follow_ups`
- `follow_up_checklist_items`
- `follow_up_series` or equivalent normalized recurrence storage

Exact columns and constraints are finalized in the implementation plan after checking the
current schema. Database constraints enforce valid lifecycle values, priority, relation shape,
recurrence intervals, and cancellation requirements where practical.

All reads require an authenticated OPS user and RLS admin access. Writes use narrow
`SECURITY DEFINER` RPCs that:

- Independently verify `is_admin(auth.uid())`.
- Validate client/relation consistency.
- Perform record, checklist, recurrence, and activity-log changes atomically.
- Revoke execution from `public`, `anon`, and `service_role`, granting only to
  `authenticated` where appropriate.
- Never expose a public write path.

Activity entries carry `collection = 'follow_ups'` and the follow-up UUID as `record_id`.
Events include creation, field edits, checklist changes, rescheduling, completion,
cancellation, reopening, recurrence advancement, and series changes.

Server-only fetch functions follow the established result contract and never throw. Dynamic
routes validate UUID-shaped IDs before data access and render distinct not-found and temporary
failure states. Page and metadata fetches use React `cache()` and call `requireOpsUser()` before
database access.

## Accessibility And Responsive Behavior

- All actions use semantic buttons and navigation uses real links.
- Form controls have explicit labels, descriptions, and error associations.
- Tabs support keyboard navigation through the existing Tabs primitive.
- Dialogs trap focus, restore focus, and support Escape where cancellation is safe.
- Status and priority are communicated in text, not color alone.
- Tables may use responsive column reduction, but the page must not expose visible nested
  horizontal scrollbars. Mobile renders a compact stacked list where necessary.
- Dates shown in client components use the explicit `Africa/Johannesburg` time zone.

## Failure States

- Fetch failures render a module-specific temporarily unavailable state.
- Not-found and malformed IDs render a 404.
- Concurrent edits return a calm conflict message and refresh path rather than silently
  overwriting newer data.
- Recurrence completion is atomic: either completion and next-occurrence creation both succeed,
  or neither persists.
- Duplicate submissions are idempotent at the RPC boundary where lifecycle actions could be
  retried.

## Testing And Verification

Coverage includes:

- Pure view-model tests for scheduling status, recurrence calculations, metrics, filtering,
  searching, and sorting.
- Schema tests for conditional fields and recurrence rules.
- Fetch tests with mocked Supabase clients, including unavailable and not-found outcomes.
- Server-action tests for auth ordering, validation, RPC mapping, conflicts, and revalidation.
- Component tests for forms, checklists, lifecycle actions, list selection, and detail states.
- Route tests for auth, malformed IDs, 404s, and temporary failure messaging.
- SQL contract tests for tables, RLS, grants, admin checks, relation constraints, atomic
  recurrence, and activity logging.
- Rolled-back live-database verification before applying migrations.
- A manual smoke test with user authorization before writing temporary live data, followed by
  deletion of all test records.

Every implementation task runs the complete gate:

```text
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Deferred Work

- Email and WhatsApp notifications.
- Communications tab and synchronized message history.
- Invoice relations.
- Reassignment and multi-user team workflows.
- Export.
- Bulk lifecycle actions.
- Dashboard aggregation.
- Pagination and server-side list filtering.

## Acceptance Criteria

- An OPS user can create, view, edit, reschedule, complete, cancel, and reopen a follow-up.
- Every new follow-up is client-linked and creator-owned.
- Enquiry/project choices are restricted to the chosen client.
- The list accurately computes Due Today, Overdue, Upcoming, Completed, and Cancelled states in
  Johannesburg time.
- Checklists are editable and retain item-level completion history.
- Completing recurring work atomically creates exactly one next occurrence while the series is
  active.
- Recurring edits can target one occurrence or the current and future series.
- Contextual creation works from Client, Enquiry, and Project detail pages.
- Enquiry Follow-ups becomes a functional linked-record view.
- All mutations create scoped activity records.
- No email or WhatsApp message is sent.
- No visible nested horizontal scrollbar is introduced.
- The full gate passes and live migration verification leaves no temporary data behind.
