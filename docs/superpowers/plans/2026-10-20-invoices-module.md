# Invoices and Quotes Implementation Plan

1. Add commercial tables, indexes, RLS and atomic RPCs for quote drafts, sending, approval,
   deposit invoices, payments and payment-gated project conversion. Verify the SQL in a rolled-back
   transaction before applying it.
2. Add pure schemas, totals, list/detail view models and focused tests.
3. Add server-only list/detail/form fetchers and server actions for every write.
4. Build the reference-faithful invoice list, quote list, document forms and invoice detail.
5. Build the public quote review/approval route and connect quote email delivery through the
   existing authenticated mail function.
6. Enable Invoices in OPS navigation, add related invoice links where backing data exists, and
   document deliberate deviations.
7. Run `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`; compare the
   rendered desktop pages with the reference images and repair visual or workflow regressions.
8. Apply the verified migration before pushing code that reads the new tables. Push only named
   feature files after the user authorizes production deployment.

