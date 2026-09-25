# Application architecture — decisions and deviations

Source spec: `docs/prd/PRD.md` (the v2 migration/rebuild prompt)
(An earlier v1 was superseded. Note this file is the prompt itself, not an independent PRD.)
Process source: `docs/bpmn/lgndry-ops-command-center-process-flow.png`.
UI source: `docs/design-references/` (no Inbox reference was supplied).

## Owner decisions (2026-09-25)

| Question                                | Decision                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Old admin                               | Dropped — no Content/CMS module in the new OPS. Stays live on `main` until the new Inbox reaches parity, then is deleted. |
| Mail provider                           | Stay on Titan/GoDaddy over IMAP/SMTP. Gmail/Graph adapters are deferred.     |
| Delivery                                | Staged. Old admin live until parity.                                         |
| Repository                              | Migrate in place on branch `next-migration`.                                 |

Consequence of dropping the old admin: the public site's editable content
(`cms`, `practice`, `budgets`, `collection` tables) and `orders` lose their
editor. During the public-site migration that content becomes static content
in the codebase, seeded from the current rows. `orders` has no admin view
until/unless the owner asks for one.

## Deviations from the spec, and why

- **`src/proxy.ts`, not `src/middleware.ts`.** Next.js 16 renamed the
  convention. Same behaviour, new filename and export name (`proxy`).
- **TypeScript 6.0.x, not 7.** `typescript-eslint` requires `typescript <6.1`;
  TypeScript 7 would break linting. Revisit when typescript-eslint supports 7.
- **ESLint 9, not 10.** `eslint-config-next` depends on eslint-plugin-react,
  jsx-a11y and import, none of which declare ESLint 10 support yet.
- **`vitest.config.mts`** so the config loads as an ES module.
- **RBAC deferred to the data-foundation phase.** Until then access is the
  same rule the legacy admin used: a row in `admin_users` (RLS-protected via
  `is_admin(auth.uid())`), re-checked server-side on every OPS request.
- **Quote entity added.** The BPMN has a Quotes data store (version, line
  items, approval status, expiry) that the spec's entity list omits.
- **WhatsApp channel** (BPMN intake) is recorded as an enquiry source only;
  no WhatsApp integration is planned yet.
- **Email provider interface** gets an IMAP/SMTP implementation first. IMAP has
  no labels, snooze, scheduled send or rules, so those are application-level
  state stored in our database, not provider features.

## Known gaps to close in later phases

- The Supabase schema is not migration-driven yet: columns added to `emails`
  (`body_html`, `attachments`) were applied directly. The data-foundation phase
  baselines the live schema into `supabase/migrations/` first.
- Email threading needs `Message-ID` / `References` headers, which the legacy
  sync doesn't store; the new sync must capture them (a re-sync of the ~44
  existing messages is required).
- Google OAuth client-secret files sit untracked in the repo root. They are not
  part of the app and must never be committed.
