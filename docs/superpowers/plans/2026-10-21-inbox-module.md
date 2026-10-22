# Inbox Module Implementation Plan

1. Add and test the additive mailbox migration. Preserve legacy `emails`, backfill threads, add private
   attachment storage, admin-only RLS, and narrowly granted write RPCs.
2. Upgrade Titan sync and Resend inbound/outbound Edge Functions to capture threading headers,
   associate contacts, and maintain thread summaries.
3. Add pure Inbox types, schemas, folder/search/view-model logic, and their tests.
4. Add server-only list/detail/options fetchers and tests using the established result-state pattern.
5. Add Server Actions for thread state, draft lifecycle, record linking, signed attachment uploads,
   sending, and manual sync.
6. Build the four-pane Inbox UI from the supplied mockup, including responsive pane navigation and
   accessible empty/error/loading states.
7. Enable Inbox in OPS navigation and add focused page/component tests.
8. Run the full gate, compare the result to the specification and mockup, and record deliberate
   limitations in `docs/architecture/application-architecture.md`.
9. Verify SQL in a rolled-back live transaction. Apply only after the verification passes, then push
   the code. The migration must land before code that reads the new schema is deployed.
