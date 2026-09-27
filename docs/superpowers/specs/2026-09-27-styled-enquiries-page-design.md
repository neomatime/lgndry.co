# Styled Enquiries Page — Design Spec

Sub-project 2 of the OPS Command Center rebuild (sub-project 1 was the
attachment pipeline and enquiry record — see
`docs/superpowers/specs/2026-09-27-attachment-pipeline-and-enquiry-record-design.md`
and `docs/architecture/application-architecture.md`'s "Phase 5, sub-project 1"
section). Builds the real, styled Enquiries list and detail pages, replacing
the bare `/ops/enquiries` verification page from sub-project 1.

Visual reference: `docs/design-references/enquiries.png` (list) and
`docs/design-references/view-enquiry.png` (detail). Both are the OPS Command
Center's original design language, but neither maps onto the live schema or
codebase exactly — see "Deviations from the reference images" below for every
place this spec departs from them, and why.

## Scope boundary

**In scope:**
- `/ops/enquiries` — the styled list page (replaces the bare page)
- `/ops/enquiries/[id]` — a new styled detail page
- A small set of new, reusable OPS UI primitives (`StatusBadge`, `StatCard`,
  a generic `Tabs` component) that later OPS modules (Projects, Clients,
  Follow-ups, Invoices) will also use
- One in-scope bugfix: `src/features/start-a-project/actions.ts`'s existing
  `ops_activity_log` insert never captures the enquiry id `submit_enquiry()`
  returns, so the log entry has no `record_id`/`collection` and can't be
  filtered per-enquiry. Fixed here because the Activity tab needs it.
- Proper error handling on both pages (the bare page's deferred gap — see
  below)

**Explicitly out of scope** (deferred to later sub-projects, once their
backing systems exist — not stubbed, not half-built):
- **Communication tab / Communication Snapshot** — needs the Inbox/email
  system (a separate, not-yet-built sub-project)
- **Follow-ups tab** — needs the Follow-ups module (not yet built)
- **Qualification Checklist** — a new concept (checklist items, per-item
  assignee, due date, checked state) with no backing table
- **Routing & Ownership (assignee / supporting team)** — the project has
  exactly one admin user today; there is no multi-staff team to assign to
- **Opportunity Snapshot** (estimated value, likely milestone, proposal
  readiness) — a new concept with no schema
- **Edit Enquiry / Qualify Enquiry actions** — write flows (editing fields,
  changing status) are new scope beyond making the *read* side real; deferred
  to whichever later sub-project adds status management
- **Export button, "New Enquiry" manual-create button** — new functionality
  beyond styling the existing read path
- Website nav/IA changes, legacy form retirement — unrelated sub-projects

## Deviations from the reference images

1. **Status values.** The reference shows `New / Awaiting Review / Qualified
   / Missing Files / Follow-up Needed` (pills) and `All / New / Reviewed /
   Qualified / Archived` (filter tabs). The live `enquiries.status` check
   constraint (from sub-project 1) already fixes the real values: `New,
   Reviewing, Quoted, Follow-up, Booked, In Production, Completed, Closed`.
   This spec uses the real values throughout; the reference's wording is
   replaced, not extended.
2. **"Services Requested" tags → single `project_type` pill.** The reference
   shows multiple tag pills (Photography, Drone, Lifestyle, Content for
   Social). The real form collects exactly one `project_type` value from a
   fixed enum (Documentary/Event/Film/Visual Production/Other). Rendered as
   one pill, not invented multi-tag data.
3. **No "Owner" stat card / no assignee column.** The reference shows a
   per-enquiry owner (Alex O'Connor, Liam Parker, etc.). There is one admin
   user in the whole project today; an assignee concept is premature.
4. **Enquiry ID display.** The reference shows a sequence-style id
   (`ENQ-0241`). The schema has no such sequence — enquiries are keyed by
   uuid. This spec displays a truncated form of the real uuid, not an
   invented sequence number.
5. **No trend deltas on stat cards** ("↑ 2 from last week") — no
   status-history table exists to compute a true trend from; plain counts
   only.

## Data layer changes

No new tables and no schema migration for the pages themselves — everything
the list and detail pages need already exists (`enquiries`,
`enquiry_attachments`, `ops_activity_log`, existing Storage signed-URL
pattern).

**Fix: `src/features/start-a-project/actions.ts`.** Today:

```ts
const { error: rpcError } = await supabase.rpc(
  "submit_enquiry",
  submitEnquiryArgs(input.data, uploaded),
);
// ...
const { error: activityError } = await supabase
  .from("ops_activity_log")
  .insert({ message: enquiryActivityMessage(input.data.full_name) });
```

The RPC's return value (the new enquiry's id) is discarded, so the activity
row can never be linked to the enquiry it describes. Change to capture
`data: newEnquiryId` from the RPC call and include it in the insert:

```ts
const { data: newEnquiryId, error: rpcError } = await supabase.rpc(
  "submit_enquiry",
  submitEnquiryArgs(input.data, uploaded),
);
// ...
const { error: activityError } = await supabase.from("ops_activity_log").insert({
  message: enquiryActivityMessage(input.data.full_name),
  collection: "enquiries",
  record_id: newEnquiryId,
});
```

No RLS/policy change needed — `ops_activity_log`'s existing
`public_insert_activity` policy already grants `anon, authenticated` insert
access (from `supabase/migrations/20260926_restrict_admin_tables_to_admins.sql`),
and `collection`/`record_id` are existing nullable columns.

**Nav:** flip `Enquiries` from `available: false` to `available: true` in
`src/components/layout/ops-nav.tsx` once the page ships.

## New shared primitives

Small, reusable — later OPS modules need the same look, so these are built
once here rather than copy-pasted per module.

- **`StatusBadge`** (`src/components/ops/status-badge.tsx`) — takes one of
  the 8 real status strings, renders a pill with a per-status color (e.g.
  New = neutral, Reviewing/Quoted = amber/blue progress tones, Booked/In
  Production = green, Completed = green-dark, Closed = muted/grey,
  Follow-up = amber). Exact colors chosen to fit the existing Tailwind theme
  tokens already used elsewhere (`text-ink-muted`, `bg-line`, etc.) — no new
  color tokens invented.
- **`StatCard`** (`src/components/ops/stat-card.tsx`) — icon circle
  (`lucide-react` icon), label, big number. No delta/trend slot.
- **`Tabs`** (`src/components/ui/tabs.tsx`) — a small, generic
  tab-list-plus-panel component (active tab styling, keyboard-accessible),
  used by the detail page's Overview/Attachments/Activity tabs. Not
  OPS-specific — lives in `components/ui` alongside `Button` since any
  future page (OPS or public) could use it.

## `/ops/enquiries` (list page)

**Data fetch:** one Server Component fetch on page load — every `enquiries`
row plus a per-enquiry attachment count (a single query with a count
aggregate, not N+1). No pagination, no server-side filtering — the full list
is handed to a Client Component that does search/filter/sort/selection
entirely client-side. Justified by current scale (an internal OPS tool, near
-zero volume today); revisit if/when volume genuinely grows.

**Stat cards** (plain counts, computed from the fetched list):
- **New** — count where `status = 'New'`
- **Reviewing** — count where `status = 'Reviewing'`
- **Quoted** — count where `status = 'Quoted'`
- **Missing Attachments** — count where the enquiry has zero attachment rows
  (a real, actionable signal — the visitor didn't attach a brief)

**Filter tabs:** `All` plus one tab per status (8 tabs total), each showing
its count, horizontally scrollable on overflow (same pattern
`OpsNav` already uses on mobile). Selecting a tab filters the client-side
list; no navigation/refetch.

**Search:** a text input filtering client-side against
`full_name`/`company`/`email`/`project_type` (case-insensitive substring).

**Sort:** newest/oldest by `created_at`, client-side.

**Table columns:** checkbox, Enquiry ID (first 8 characters of the uuid,
uppercased — e.g. `2212D6C8`, not a claim of real sequence numbering),
Client/Contact (`full_name` + `company` beneath), Project Type, Submitted
(`created_at` formatted as a short date, `en-ZA` locale, matching the
existing bare page's date formatting), Attachments (count with a paperclip
icon), Status (`StatusBadge`). No Assignee column.

**Row interaction:**
- Checking a row's checkbox shows a lightweight inline preview panel at the
  bottom of the page: Enquiry Details (id, client, contact, status, project
  type, submitted date), Project Brief (`description` text), Attachments
  preview (file names + signed links), no invented sections (no Qualification
  Checklist / Next Steps / Recent Activity feed in this preview — those
  either don't exist yet or belong on the full detail page's Activity tab).
- Clicking the row itself (or the Enquiry ID) navigates to
  `/ops/enquiries/[id]`.

**Error handling:** the fetch destructures `{ data, error }`; on error, log
via `console.error` and render the existing `ErrorState` component instead of
an empty table. An empty (but successful) fetch renders `EmptyState`
("No enquiries yet — submissions from /start-a-project will appear here"),
matching the bare page's existing copy.

## `/ops/enquiries/[id]` (detail page)

**Data fetch:** one Server Component fetch per load — the enquiry row, its
attachments (with signed URLs), and its `ops_activity_log` rows (filtered
`collection = 'enquiries' AND record_id = :id`, newest first). A `notFound()`
(Next.js 404) for an unknown/invalid id.

**Header:** breadcrumb ("Enquiries / {truncated id or company name}"), title
(`{company || full_name} Enquiry`), subtitle (contact name), "Back to
Enquiries" button (→ `/ops/enquiries`). No Edit/Qualify action buttons (see
Scope boundary).

**Stat-card row:** Status (`StatusBadge`), Service Type (`project_type`),
Budget (`budget`, or "Not specified" if null), Timeline (`timeline`),
Attachments (count). No Owner card.

**Tabs (`Tabs` component):**
- **Overview** — Enquiry Overview (`description`, as prose, preserving
  line breaks), Services Requested (single `project_type` pill, styled the
  same as the table's status pill family but a neutral tone)
- **Attachments (N)** — full list: file name, size (formatted, e.g. "2.4 MB"),
  a link that opens the signed URL in a new tab (`target="_blank"`,
  `rel="noopener noreferrer"`, matching the bare page's existing pattern)
- **Activity (N)** — `ops_activity_log` rows for this enquiry, newest first:
  message text + relative timestamp (e.g. "2 hours ago" — a small helper
  function, not a new dependency). Empty state: "No activity recorded yet."

**Right rail:**
- **Enquiry Details** — id (full uuid, selectable/copyable), client
  (`company` or "Individual"), contact (`full_name`), project type, source
  (`source`, always "Website" today), location (`location`), status
- **Contact Details** — name, email (`mailto:` link), phone (`tel:` link),
  company
- **Attachments preview** — first 3 attachments + "View all →" (scrolls/jumps
  to the Attachments tab)

**Error handling:** same destructure-log-render-`ErrorState` pattern as the
list page. A genuinely missing enquiry (valid uuid shape, no matching row)
renders Next's `notFound()`, not an error state.

## Testing plan

- **Pure-function unit tests** (new files alongside the components that use
  them, following this codebase's established co-location pattern):
  - Stat-card count computation (given a list of enquiries, returns the 4
    counts)
  - Client-side filter/search/sort logic (status tab, search substring
    match, sort direction)
  - Row-shaping for the list table and the detail page's fetched data
    (an evolution of the existing `buildEnquiryRows` from sub-project 1)
- **Component tests** (Testing Library, matching this codebase's existing
  patterns in `start-a-project-form.test.tsx` etc.):
  - List page: search narrows the visible rows; selecting a status tab
    filters correctly; checking a row's checkbox shows the inline preview
    with correct content; clicking a row/id triggers navigation
  - Detail page: tabs switch visible content; an attachment's link resolves
    to its signed URL; activity entries render in the right order; the
    error state renders on a fetch failure (mocked)
- **`actions.ts` fix verification**: extend the existing
  `actions.test.ts` to assert the `ops_activity_log` insert now includes
  `collection: "enquiries"` and `record_id` equal to the RPC's returned id
  (currently untested since the field didn't exist in the call).
- **Full gate suite** (`format:check`, `typecheck`, `lint`, `test`, `build`)
  green before any task in the implementation plan is considered done, per
  this project's established practice.

## Documentation

Append a "Phase 5, sub-project 2" section to
`docs/architecture/application-architecture.md` once shipped, following the
same structure as sub-project 1's entry (What's new / Deliberately unchanged
/ Verification / Still open).
