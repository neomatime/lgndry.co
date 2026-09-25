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

## Phase 3 — public website migration (in progress)

Slice 1 (homepage) is done. The remaining pages migrate in slices; each page is
added to the `.html` → clean-URL redirect list in `next.config.ts` only when it
ships, so the branch never redirects to a page that doesn't exist yet.

### Approach

- **Legacy CSS is ported verbatim**, not rewritten in Tailwind (6,000 lines of
  tuned styling; a rewrite would only add visual risk). `src/styles/public/`
  holds `style.css`, `premium.css`, `editorial-sharp.css` with exactly two
  mechanical edits: font-family rules are prefixed with the next/font
  variables, and one relative `url()` is made absolute. Additions live in
  `overrides.css`. Tailwind is used for OPS and new components only.
- **Two root layouts** (`(public)` and `(app)` route groups) fully isolate the
  two CSS worlds; Tailwind's reset would otherwise clobber the legacy styles.
  Consequence: unmatched URLs get Next's default 404 until a public 404 page is
  added.
- **`/assests/...` image URLs are preserved** (files live in `public/assests/`).
  The signature banner URL is embedded in every email already sent, so it must
  not move. Images are served as-is (`images.unoptimized`) since they are
  already optimised WebP.
- **Legacy `.html` URLs get permanent redirects** to clean URLs
  (`/index.html` → `/`), preserving search rankings and inbound links.
- **Behaviour is rebuilt as React components** (`src/components/site/`); the
  scroll maths is extracted as pure functions in `scroll-math.ts` and unit-tested.
  Legacy `window.lgndryNav` was dead code and was not ported.

### Things the HTML source did not show (found by measuring the running page)

The legacy page mutates its own DOM at runtime. Reading `index.html` alone
missed both of these; they are now ported:

1. A **shopping-cart link with a live item count** injected into the header by
   `commerce-core.js`. Cart storage (`lgndry_collection_cart_v2`) is unchanged,
   so carts started before cutover survive it.
2. **Customer account links in the nav panel** ("Log In / Create Account", or
   "My Account"), injected by `customer-auth.js` from the Supabase session.

Lesson for the remaining pages: compare the running legacy page against the new
one, not just the markup.

### Verification method and result (homepage)

Legacy and new pages were served side by side and compared in a real browser.
At 1440px and 390px: every measured element (position, size, font, colour,
transform) is identical, and total document height matches to the pixel (8,325
and 8,172). The hero scroll scrub, the pinned gallery, header scrolled state,
the slideshow timing (5,000ms hold / 1,400ms fade), the nav panel (including its
mobile photo backgrounds) and the loader behave the same. Only known, harmless
difference: `next/image` adds `color: transparent` to `<img>`.

### Known issues carried over from the legacy site (left byte-for-byte)

- `style.css` contains `font-family:''Inter'',...` (double-quoted twice) on two
  rules for the catalogue/checkout labels. It is invalid CSS in the original, so
  browsers ignore it; the port is identical. Fix when the shop pages migrate.

### Decisions for the owner at cutover

- **Shared sign-in session.** OPS and the public customer accounts use the same
  Supabase Auth project, and the new browser client stores its session in
  cookies. A staff member signed into OPS therefore also appears signed in on
  the public site (nav shows "My Account"). Existing customers signed in on the
  legacy site will need to sign in once after cutover (different storage).
- **Preview deployments** need `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for the Preview environment in Vercel.
