# Bookings & Partnerships Module Design

## Purpose

Bring the public booking and brand-partnership forms into the authenticated OPS Command Center as one operational workspace. This workspace belongs to LGNDRY.Co staff; it is not a client portal.

## Information architecture

- Add one `Bookings & Partnerships` item to the Work section of the OPS sidebar, after Enquiries.
- Route the module at `/ops/engagements`.
- Provide three views in one module: Booking Requests, Partnerships, and Calendar.
- Booking and partnership rows link to dedicated detail pages with edit and status controls.

## Booking workflow

Statuses are `New`, `Reviewing`, `Quote Sent`, `Awaiting Deposit`, `Confirmed`, `Completed`, and `Cancelled`.

- A public submission starts as `New` and its requested date is tentative.
- OPS can review and amend the record, associate the right client/contact, and progress its status.
- `Quote Sent` and `Awaiting Deposit` remain tentative.
- A booking becomes `Confirmed` only after the required deposit is recorded. Manual confirmation remains available for legacy or externally paid work but is explicit.
- Confirmed and tentative records both appear in the calendar. Their labels include their state so meaning never depends on colour alone.
- Cancelled records remain available as history but do not contribute to active metrics.

## Partnership workflow

Statuses are `New`, `Reviewing`, `Qualified`, `Proposal Sent`, `Active`, `Closed`, and `Declined`.

- Public submissions retain structured partnership type, requested focus areas, brand context, cadence, budget, contact and client relationships.
- OPS can review, amend, assign, and progress the record.
- Partnerships are visible alongside booking requests in the unified workspace but do not occupy calendar dates unless a future project or booking is created from them.

## Public form ingestion

- Replace the current multi-insert form path with one `SECURITY DEFINER` RPC per public form.
- Each RPC validates lengths and required values, reuses a matching non-archived client/contact by email where possible, inserts the operational record, and writes activity in one transaction.
- Public RPCs expose only the narrow submission contract to `anon` and `authenticated`; tables remain protected by RLS.
- Existing legacy rows are preserved and backfilled to the new status model.

## OPS writes

- All authenticated mutations use admin-gated `SECURITY DEFINER` RPCs.
- RPCs use an empty pinned `search_path`, optimistic version checks, and return structured `ok`, `not-found`, `conflict`, or `invalid` results.
- The current authenticated user is the default owner of newly received records when an owner can be resolved; legacy/unassigned rows remain valid.

## Calendar

- Month view with previous, today, and next controls.
- Shows booking counts and individual booking links on their requested date.
- Tentative events use a dashed treatment and include `Tentative` in visible text.
- Confirmed events use a solid treatment and include `Confirmed` in visible text.
- Undated booking requests remain visible in the Booking Requests view and an `Unscheduled` metric.
- Dates are interpreted and formatted in `Africa/Johannesburg`.

## List and detail experience

- Summary cards: new booking requests, tentative dates, confirmed bookings, and open partnerships.
- Client-side search, status filtering, and newest/date sorting are sufficient at current volume.
- Detail pages surface contact, client, schedule, request content, owner, status, and recent activity.
- Long text wraps and tables have no visible nested horizontal scrollbar.

## Error handling and access

- Pages call `requireOpsUser()` before data access.
- Server fetchers catch and log failures and return `null` so pages can show a distinct unavailable state.
- Dynamic fetchers validate UUIDs before querying.
- Public form errors remain generic and preserve the existing user-facing behaviour.

## Deliberate boundaries

- The first release does not add an external calendar provider, drag-and-drop scheduling, team availability, exports, or bulk actions.
- Quote and deposit records remain managed by the commercial documents module. The booking module exposes statuses compatible with that workflow; deeper automated quote-to-booking linkage can be added without changing public form contracts.
- Partnerships do not automatically create projects. OPS qualifies them first.
