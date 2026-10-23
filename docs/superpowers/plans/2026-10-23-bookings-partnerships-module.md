# Bookings & Partnerships Module Plan

## Task 1: Data contract and migration

- Add structured booking and partnership fields, status constraints, ownership, timestamps, and optimistic versions.
- Backfill legacy status values without deleting historical data.
- Add narrow transactional public submission RPCs.
- Add admin update/status RPCs and grants.
- Add SQL contract tests and run the full five-command gate.

## Task 2: Public form wiring

- Replace direct multi-table inserts with the new public RPC calls.
- Keep existing schemas, bot trap, and form-facing result messages.
- Update unit tests for RPC payloads and failures.
- Run the full five-command gate.

## Task 3: Pure view models and fetchers

- Define booking/partnership types, status sets, metrics, filtering, sorting, and calendar month builders.
- Add server-only list/detail fetchers that follow the established error-return conventions.
- Cover view models and fetchers with focused tests.
- Run the full five-command gate.

## Task 4: Unified module UI

- Add the segmented sidebar entry.
- Build `/ops/engagements` with summary cards, booking and partnership tabs, filters, and the month calendar.
- Build booking and partnership detail pages with status and edit controls.
- Verify responsive layout and keyboard semantics.
- Run the full five-command gate.

## Task 5: Final review and release readiness

- Review against this spec, existing Enquiries conventions, and the approved monochrome design system.
- Confirm no unrelated files are staged.
- Run `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Verify the migration in an always-rolled-back transaction before requesting live application approval.
- Record architecture decisions and remaining limitations.
