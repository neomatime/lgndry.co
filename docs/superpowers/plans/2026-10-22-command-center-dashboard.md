# Command Center Dashboard Implementation Plan

## Task 1: Cross-module dashboard model

- Add dashboard source and display types.
- Build a pure view-model that calculates truthful metrics, priority queue entries, pipeline counts,
  active-record context, upcoming Follow-ups and linked activity.
- Cover date calculations with a single Johannesburg-aware request instant.
- Run the full gate suite.

## Task 2: Read-only dashboard aggregation

- Add a server-only fetcher that loads all shipped module data in parallel.
- Read recent `ops_activity_log` rows and the exact `email_threads` count directly.
- Return `null`, log the failure and preserve the page's unavailable state when a dependency fails.
- Run the full gate suite.

## Task 3: Reference-faithful overview UI

- Implement the four metric cards, Attention Queue, Engagement Pipeline, Active Record, Upcoming
  Follow-ups and Recent Activity panels.
- Use real links and the established monochrome OPS tokens.
- Keep dense columns to wide desktop and use stacked rows at narrower widths to prevent horizontal
  overflow.
- Replace the `/ops` placeholder and preserve authentication before data access.
- Run the full gate suite.

## Task 4: Verification and architecture record

- Add pure view-model and page tests.
- Compare the completed hierarchy to `command-center.png` and remove unsupported sample controls.
- Record boundaries and release state in the architecture document.
- Run `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
