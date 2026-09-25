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

## Phase 3, slice 2 — About, Services, Contact (showroom deferred)

### Scope decision: showroom moves to the shop slice

`showroom.html` is an empty shell that `showroom.js` fills from the `collection`
table (artwork detail, size/framing choices, add-to-cart, related works). It
depends on the catalogue, the cart and checkout, so it migrates with them, not
with the static pages.

### Runtime behaviour found in the legacy scripts (not visible in the HTML)

- **Database-driven page text.** `site-data.js` overwrote text from the `cms`,
  `practice` and `budgets` tables on every page. Content is now static in
  `src/content/`, seeded from the live rows on 2026-09-25 (practice matched the
  HTML; budgets did not, so the *database* wording is what visitors see today).
  With the old admin retired, edit these files to change wording.
- **Booking modal** attached to *any* link or button whose text contained the
  word "book". **Partnership modal** attached to links mentioning "brand
  partnership"/"apply to partner". Both are now built once
  (`features/lead-capture/components/lead-modal.tsx`) and opened only by
  explicit `BookingTrigger` / `PartnershipTrigger` links, which keep a
  `mailto:` href as the no-JavaScript fallback.
- **Custom dropdowns and date picker** were injected onto every `<select>` and
  date input. Rebuilt as `Select` and `DatePicker` components with the same
  markup and classes, so the ported CSS applies unchanged.

### Lead capture (writes to the live database)

Server actions (`features/lead-capture/actions.ts`) validate with zod, then
insert with the visitor's anon-role client, so row-level security still applies.
Stored formats (`clients` Lead rows, `bookings` Enquiry rows, `partnerships`
Applied rows, `notes` / `application` strings, `ops_activity_log` messages) are
identical to the legacy ones, because the current admin reads them; a test pins
them. Verified against the live schema with an anon-role insert inside a rolled
back transaction (no rows persisted).

Added protections: server-side validation with length limits, a honeypot field,
activity messages truncated to the database's 200-character limit.

### Deliberate differences from the legacy site (please review)

| Change | Why |
| --- | --- |
| **About → Founder section shows the intended text.** The live legacy page shows the first bio paragraph in place of the "Founder" label, replaces the first paragraph with the second bio, and so shows the second bio twice. | Bug in the legacy CMS script's selector (`p:nth-of-type(1)` also matches the label). Not reproduced. |
| About headline has no forced line breaks. | The legacy script replaced the HTML's `<br>`s with unbroken CMS text, so that is what visitors see. |
| Picking "Book a photography session" / "Ready to book now" in the Contact dropdowns no longer also opens the booking modal. | The word-matching rule caught the dropdown's own option buttons. Accident. |
| Date picker: **Clear** and **Today** now work; keyboard users can open it. | A stray quote in the legacy markup disabled both buttons; the field had no key handler. The date remains optional, as before. |
| Native `<select>`s are hidden from screen readers and the tab order. | The legacy version announced each dropdown twice. |
| A partnership applicant's **role** is now saved (appended as "Contact role: …"). | The legacy form collected it but never stored it. |
| The booking/partnership budget choice can no longer be scrambled by the late database response. | Legacy race: choosing before the list refreshed recorded a different option. |
| Booking / partnership dialogs are `inert` while closed. | Keyboard focus could wander into the hidden dialog. |

### Verification

Legacy and new pages were compared in a real browser by recording the size,
position and typography of every classed element, at 1440px and 390px. Services:
identical. Contact: identical. About: identical except the Founder section above.
Both modals were driven through all four steps on each side and compared
(booking: 414 of 457 identical, the rest sub-pixel or the legacy budget race;
partnership: 360 of 408 identical, 45 sub-pixel, 3 from the same race). Known
accepted difference: ~0.3px in form-control intrinsic width between the two
copies of the Inter font. Nothing was submitted on either side, because forms
write to the live database.

## SECURITY ISSUE (existing, not caused by this migration) — FIXED 2026-09-26

Fourteen tables carry a policy `authenticated_full_access` with
`USING/WITH CHECK (auth.role() = 'authenticated')` for command ALL:
`bookings, budgets, clients, cms, collection, content, documents, galleries,
invoices, journal, ops_activity_log, partnerships, practice, projects,
push_subscriptions`. It grants full read/write/delete to **any signed-in user**,
not only admins. Customers can register on the public site (the project has 5
auth users, 1 of them an admin), so a customer session could read or change
client contact details, invoices and collection prices through the API.

Not exploited, not changed. Proposed fix: replace `auth.role() = 'authenticated'`
with the existing `is_admin(auth.uid())` on the admin-only tables, keep (or add)
explicit anon SELECT policies for the tables the public site reads (`cms`,
`practice`, `budgets`, `collection`), and add tests. Needs the owner's approval
because the current admin and the public site both depend on these policies.

### Status: APPLIED to the live database on 2026-09-26

`supabase/migrations/20260926_restrict_admin_tables_to_admins.sql` (rollback in
`supabase/rollbacks/`). It replaces `authenticated_full_access` with an
`is_admin()` policy on the 15 tables, and does the same for write access to the
`media` storage bucket (which had the identical "any signed-in user" rule).
It also widens the ten existing `TO anon` public policies to
`anon, authenticated`, because signed-in customers and staff currently rely on
the broad policy for catalogue reads and enquiry inserts; without that they
would lose both.

Tested before and after applying, in rolled-back transactions (nothing persisted): as anon, as a
non-admin signed-in user and as the admin. Customer: sees the same public
content as anon, sees zero rows in the admin tables, cannot update, delete or
upload, can still submit leads. Admin: full access. The Titan sync and the
notification triggers use the service role / SECURITY DEFINER and are
unaffected. Apply order: apply the migration to the shared database; the legacy
admin keeps working because only the single `admin_users` member signs into it.

## Phase 3, slice 3a — Collection, Showroom, Cart

The catalogue is live data (prices, stock and new works are edited in the old
admin), so unlike the content pages it is **not** seeded into code.

- `features/shop/catalogue/data.ts` reads the `collection` table as the anon
  role with no cookies (RLS already hides archived/hidden works). The
  `/collection` and `/showroom/[id]` pages are statically generated and
  revalidated every 60 seconds, so a price or stock change appears within a
  minute. If the database can't be reached the collection page shows the same
  "temporarily unavailable" message the legacy page did.
- **Environment:** the build and the running site need `NEXT_PUBLIC_SUPABASE_URL`
  and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the *Preview* and *Production*
  environments in Vercel. Without them these pages render the unavailable state.
- Image paths in the table are either full storage URLs or site-relative
  ("assests/images/..."). Relative ones must exist under `public/`; the ones
  the current rows use were copied there. New works added through the admin use
  storage URLs and need nothing.
- `/showroom.html?id=X` redirects to `/showroom/X`; an unknown id is a real 404
  with the legacy "artwork could not be found" content.
- The cart is the same localStorage key and line format as the legacy site
  (`lgndry_collection_cart_v2`), so a cart started before cutover survives it.
  Pure operations (add/merge/clamp/remove/totals) live in `cart-storage.ts` and
  are unit tested; `useCart` exposes it to React.
- Prices render through `formatMoney` (non-breaking-space thousands, as the
  legacy `en-ZA` output) so the server and browser produce identical text.

### Verification

Element-by-element geometry/typography comparison against the running legacy
pages, 1440px and 390px, same data and same cart contents on both sides:
collection 221/222 and 355/357 (the rest is `next/image` transparent-colour
noise), showroom 205/207 desktop (cart badge, and a hover scale because the
pointer was over the legacy image) and 207/207 phone, cart 57/57 on both.
Document heights are identical on every page. Room-preview scale maths were
checked against the legacy values for the same size and room (0.278 / 0.225).
Interactions (filter, sort, search, add, gallery, rooms, frame/size/quantity,
cart edit/remove) were exercised in the browser. Nothing was submitted.

### Deliberate differences

| Change | Why |
| --- | --- |
| Showroom content is in the server HTML and appears at once; no "Preparing the showroom" fade. | The legacy page was an empty shell filled by script. |
| Opening a work from the grid no longer flashes the full-image lightbox for 90 ms. | Legacy quirk: two scripts both reacted to the same click. |
| Ctrl/Cmd/middle-click on a work opens a new tab as a browser normally would. | Legacy intercepted every click. |
| Cart quantity commits on Enter/leaving the box/spinner, not per keystroke. | Legacy fired on `change` (same), but a React input would otherwise remove the line while the box is cleared to type a new number. |
| Every dropdown trigger has an accessible name (e.g. "Print size for Gae: 50 × 70 cm"). | The legacy custom dropdown had none. |
| Old `/showroom.html?id=X` links carry the id as a harmless extra `?id=` after redirecting. | Next.js copies the source query onto redirects. |

### Still to do in the shop group

Checkout and order confirmation (writes `orders`, and today trusts the prices
in the visitor's cart: to be recomputed from the database server-side), then
sign-in/account/auth-callback and the client gallery page.
