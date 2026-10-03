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

## Phase 3, slice 3b — Checkout and order confirmation

Route groups under `(public)`: `(storefront)` pages share the full header and
menu panel; `(checkout)` pages (checkout, order confirmation) get the slim
`CommerceHeader` (brand, page name, cart, one way back) and no menu, matching
the legacy `commerce-header`.

### Orders are priced on the server (behaviour change, security)

The legacy checkout sent the whole cart, prices included, straight to the
database, so a customer could edit a price in their browser and pay it. The
`placeOrder` server action (`features/shop/checkout/actions.ts`) now takes only
*which* work and the visitor's choices (size, framing, quantity), then:

- re-reads the collection and prices everything from it (`order.ts`, unit tested);
- refuses a direct purchase of a work that is no longer available or has fewer
  units left than requested, and an order for a work that has left the collection;
  an "Order Request" may include any work (that is how reserved and sold-out
  pieces are enquired about);
- recomputes delivery (R250, free for collection) and totals;
- refuses payment methods other than EFT / payment in person (card is
  "Coming soon", switched by `content/payment.ts`);
- has a honeypot, zod validation and length limits, and retries with a new
  order number on the (rare) unique-number clash.

The stored `orders` row is otherwise identical to the legacy one (same columns,
`items` JSON with `unitPrice`/`lineTotal`, same placeholder text for collection
addresses, same activity-log line), so the current admin reads it unchanged.

Ownership: a signed-in customer **with a confirmed email** gets the order linked
to their account (`customer_id`); everyone else orders as a guest. Legacy tried
to link an unconfirmed user's order and the database refused it; the new action
falls back to a guest order instead. Verified against the live policies in
rolled-back transactions (guest insert, activity log, cannot link an account or
read orders; customer insert, sees only their own order, cannot insert an
unlinked one).

### Verification

Element-by-element geometry/typography comparison with the legacy pages, same
cart, 1440px and 390px: checkout identical apart from the honeypot input shifting
the classless-input index (document heights identical, 2350 and 3554);
confirmation identical in all three states (with order 33/33 and 33/33 phone,
order mismatch 16/16). Form behaviour (Collect in person, billing toggle,
required fields, validation gate, disabled card) was exercised in the browser.
No order was placed: that would write to the live database.

### Deliberate differences

| Change | Why |
| --- | --- |
| Prices, stock and totals come from the database, not the browser. | Security, above. |
| Signed-in customer details only fill *empty* fields. | The legacy prefill could overwrite what the customer had already typed. |
| Order confirmation link "My Account" points to `/account#orders`. | Account pages are the next slice; until they ship that link 404s on the branch. |
| Old `/checkout.html?type=request` and `/order-confirmation.html?order=…` redirect, query kept. | Bookmarks and emails. |

### Still to do in the shop group

Sign-in / sign-up / auth-callback, My Account, and the client gallery page.

## Phase 3, slice 3c — Sign-in, account, verification callback, client gallery

The public site is now fully migrated. Three root layouts exist: `(public)`
(storefront and checkout, full site CSS), `(account)` (sign-in, callback and My
Account) and `(gallery)`. The last two are separate documents because the
legacy pages loaded a different stylesheet set (they never loaded `style.css`);
each imports one `*-bundle.css` so the cascade order is fixed to the legacy
order (Turbopack otherwise emitted the chunks in a different order and changed
input backgrounds).

### URLs and links that must keep working

| Legacy | New | Notes |
| --- | --- | --- |
| `/auth.html?mode=…` | `/auth?mode=…` | modes: login, signup, forgot, reset, verify |
| `/auth-callback.html` | `/auth-callback` | **Supabase's redirect allow-list contains the `.html` address**, so sign-in still asks for `…/auth-callback.html` and the site redirects it, keeping `?code=`/`#access_token=` |
| `/account.html#orders` | `/account#orders` | section still lives in the fragment (`#profile`, `#tracking`, `#settings`, `#order=<id>`) |
| `/gallery.html?id=<uuid>` | `/gallery?id=<uuid>` | links already emailed to clients |

Sessions: the browser client now keeps the session in cookies (the legacy
`supabase-js` used localStorage), so the server can see the customer (checkout
links the order; `/account` loads their data on the server). Existing customers
will need to sign in once after cutover. The proxy also refreshes the session
cookies for `/account` and `/checkout`.

### Security findings and fixes in this slice

1. **Gallery passwords protected nothing (fixed in code, additive DB change applied).**
   The legacy page downloaded the whole gallery row — files *and* password — as an
   anonymous visitor and compared the password in the browser. Added
   `gallery_access()` and `gallery_mark()` (security-definer functions,
   `supabase/migrations/20260926_gallery_access_functions.sql`, applied and tested
   in rolled-back transactions): the password is checked inside the database, the
   gallery only comes back once it is satisfied, the password is never returned,
   wrong guesses are slowed, status only moves forward. The new page uses them.
2. **NOT yet fixed — direct table access for anonymous users.** The anonymous role
   can still read every non-draft gallery (files and password) and update *any
   column* of a Sent/Viewed gallery through the API, and the legacy `gallery.html`
   still uses that. `supabase/deferred/20260926_restrict_gallery_public_access.sql`
   removes it; apply it when the legacy gallery page is retired. There were no
   galleries in the database when this was written (2026-09-26), so nothing was
   exposed.
3. **NOT yet fixed — `orders.internalNotes`.** A customer can read their own
   orders, and row-level security can't hide a column, so `internalNotes` (the
   studio's private notes) is readable by the customer through the API. The new
   account page never requests it (`ACCOUNT_ORDER_COLUMNS`), but the API still
   allows it. Proper fix: move internal notes to an admin-only table or a view;
   needs a decision because the current admin edits the column in place.
4. **Open redirect (fixed).** The legacy sign-in accepted `next=//evil.example`.
   `safeCustomerNext` only accepts single-slash same-site paths.
5. A signed-in but unverified user is now signed out again when they try to log
   in (the legacy left a dangling session).

### Verification

Element-by-element comparison with the legacy pages at 1440px and 390px:
sign-in (all five views) and the callback page match apart from font metrics
(below); My Account matches in all eight views (orders, profile, tracking,
settings, three order details, unknown order) with identical text and document
heights, using identical fixture data (a stubbed-auth copy of the legacy page vs
a temporary preview route, both since removed — no account was created on the
live project); the gallery's "not found" and "unavailable" states match. Not
verified visually with real data: the gallery with images / password gate (there
are no galleries to show; both flows are unit tested) and a live sign-in, sign-up,
Google or email-link round trip (needs the project's redirect list to include the
preview origin, or a test after cutover).

Known, accepted difference: on these pages the legacy stylesheet loads Inter from
Google and the site now self-hosts the variable Inter, whose `line-height: normal`
is about a pixel shorter on ~11px labels. No layout shifts beyond ~2px.

### After cutover

Retire `assests/js` and the legacy HTML, apply the deferred gallery migration,
decide on `internalNotes`, and check the Supabase Auth redirect URLs (Site URL and
the `…/auth-callback.html` entry) match the production domain.

## Phase 5, sub-project 1 — Attachment pipeline and enquiry record

The first piece of the OPS Command Center rebuild (see
`docs/LGNDRY_Command_Center_Refinement_Scope.md` and
`docs/superpowers/specs/2026-09-27-attachment-pipeline-and-enquiry-record-design.md`).
A public "Start a Project" form (`/start-a-project`) now exists, matching the
website refinement scope's §11 field list, and is the first form on the site
that accepts file attachments.

### What's new

- `enquiries` and `enquiry_attachments` tables, and a private
  `enquiry-attachments` Storage bucket (15 MB/file, PDF/JPG/JPEG/PNG/DOC/
  DOCX/XLS/XLSX only, enforced at the bucket level and again in code).
- All public writes go through one `SECURITY DEFINER` function,
  `submit_enquiry()` — there are no direct anon policies on
  `clients`/`enquiries`/`enquiry_attachments`, because matching an enquiry to
  an existing client needs to read `clients` by email first, which `anon`
  must never do directly.
- Every attachment is validated twice: cheaply in the browser (extension,
  size), and authoritatively on the server (extension, size, and a
  magic-byte check that the file's real content matches what its extension
  claims — catching a mislabelled or disguised file a declared MIME type
  alone would not).
- A bare admin page, `/ops/enquiries`, lists every submission and opens each
  attachment through a short-lived signed URL. Deliberately unstyled — the
  full Enquiries page (matching `docs/design-references/enquiries.png` /
  `view-enquiry.png`) is its own later sub-project.

### Deliberately unchanged

The existing Contact page, Booking dialog and Partnership dialog keep
writing into `clients`/`bookings`/`partnerships` exactly as before — a
temporary, intentional parallel path. Nothing links to `/start-a-project`
yet; nav/CTA wiring is the later website-structure sub-project. Existing
`clients`/`bookings`/`partnerships` rows were not migrated into `enquiries`.

### Verification

Full gate suite green (`format:check`, `typecheck`, `lint`, `test` — 300/300,
`build`). The Server Action body-size limit was raised to 80 MB
(`next.config.ts`, `experimental.serverActions.bodySizeLimit`) and proven
against a real, valid 10.2 MB PDF plus a small JPG submitted through
`/start-a-project` **on the local dev server** (against the live Supabase
project): the enquiry, client and both attachment rows landed with byte-exact
sizes, and both Storage objects were confirmed present with matching sizes
and MIME types. The test enquiry, attachment rows and client row were deleted
afterward (the two uploaded Storage objects were left behind — a harmless,
accepted minor gap, not worth building cleanup tooling for in this
sub-project).

**Not yet proven against the actual Vercel deployment** — see "Known risk"
below.

### Known risk — Vercel's platform request-size limit (not yet resolved)

Vercel Functions cap a request body at roughly 4.5 MB regardless of any
Next.js-level config (`bodySizeLimit` only raises Next's *own* limit; it
cannot raise the platform's). The one live end-to-end test this sub-project
ran was against the local dev server, which has no such cap, so it did not
actually exercise this limit. A live repro against the deployed Vercel
preview was attempted and not completed (blocked by the deployment's SSO
protection plus an unrelated tooling denial), so this remains **unverified
in production**, not resolved.

Given the spec's 15 MB/file, 5-files/submission limits, most real
submissions will very likely exceed 4.5 MB and fail with a platform-level
413 once this page is linked from the nav. The fix, if the limit is
confirmed, is architectural — short-lived signed upload URLs straight from
the browser to Storage, bypassing the Server Action for the file bytes
entirely — which changes Task 4 and Task 5's design and needs its own
brainstorming/plan pass. Do this **before** wiring `/start-a-project` into
the site nav or otherwise directing real traffic at it.

### Still open

- **The Vercel request-size risk above — resolve before going live.**
- The styled Enquiries list + detail page (next sub-project). Its admin page
  currently swallows Supabase/Storage query errors as empty results with
  nothing logged (an accepted, deferred gap in the bare `/ops/enquiries`
  verification page) — worth fixing when that page is rebuilt.
- Quotes, bookings, payments, communication history and follow-ups will
  reference `enquiries.id` when each is built; none of that exists yet.
- Retiring the legacy forms, and the website nav/IA change to Work /
  Practice / Fine Art / About / Start a Project.

## Phase 5, sub-project 2 — Styled Enquiries page

The second piece of the OPS Command Center rebuild (see
`docs/superpowers/specs/2026-09-27-styled-enquiries-page-design.md`). Replaces
the bare `/ops/enquiries` verification page from sub-project 1 with a real
list page and a new `/ops/enquiries/[id]` detail page.

### What's new

- `/ops/enquiries`: stat cards (New/Reviewing/Quoted/Missing Attachments,
  plain counts), a filter tab per real status, client-side search and sort,
  a table with row selection (checking a row shows an inline preview;
  clicking it navigates to the detail page).
- `/ops/enquiries/[id]`: Overview/Attachments/Activity tabs, a stat-card row,
  and Enquiry Details / Contact Details right-rail panels.
- Three small, reusable primitives for future OPS modules: `StatusBadge`,
  `StatCard` (`src/components/ops/`), and a generic `Tabs`
  (`src/components/ui/`).
- Fixed a real gap: `submitProjectEnquiry`'s `ops_activity_log` insert now
  carries `collection`/`record_id`, so the Activity tab can filter to just
  its own enquiry (previously the insert had no way to be attributed to one).

### Verification

Full gate suite green at every task and again at the end
(`format:check`, `typecheck`, `lint`, `test`, `build`). Two review rounds
during execution each caught pre-existing Prettier drift from an earlier
task's files (fixed as small standalone commits) and one plan defect
(Task 3 originally deleted two files a later task still needed — fixed
by resequencing). The final whole-sub-project review found and fixed a
malformed-id 404 bug, a keyboard-navigation gap, a date-formatting
hydration risk, an uncached double-fetch on the detail page, and an
attachment-count query that could have silently truncated at scale.

**Not verified against real data.** The live database has zero enquiries
and zero linked activity-log rows as of this writing — nothing in this
sub-project has been exercised against a real submission. The planned
manual smoke check (sign in, click through both pages, open a signed
attachment link) was skipped both times it came up, for lack of dev-time
browser/preview tooling matching this project. Do this before relying on
the pages for real work: submit one throwaway enquiry through
`/start-a-project` with an attachment, confirm it appears correctly on
both pages (including a working attachment link and a populated Activity
tab), confirm `/ops/enquiries/not-a-real-id` now 404s, then delete the
test rows the same way sub-project 1's own live test was cleaned up.

### Deliberately different from the reference images

Matches `docs/design-references/enquiries.png` / `view-enquiry.png` in
layout, but not in content: uses the live 8-value `status` enum (not the
mockup's wording), renders `project_type` as one pill (not invented
multi-tag "Services"), and omits assignee/owner UI (no multi-staff team
concept exists yet), the Qualification Checklist, Communication tab, the
Follow-ups tab, and the Opportunity Snapshot (all depend on systems not yet
built). No trend deltas on stat cards (no status-history table exists). The
list also omits the mockup's fuller inline-preview detail (attachment links,
submitted date) and the detail page's right rail omits a Status row and an
attachments preview with links — both are informational-completeness gaps
versus the original design spec, deliberately deferred rather than built
now, since the underlying data already carries every field needed and
adding the rendering later is cheap.

### Deliberately unchanged

Write flows (Edit Enquiry, Qualify Enquiry, Export, manually creating an
enquiry) are not built — this sub-project makes the *read* side real.

### Still open

- Communication tab (needs the Inbox rebuild), Follow-ups tab (needs the
  Follow-ups module), Qualification Checklist, Routing & Ownership, and
  Opportunity Snapshot — each deferred to its own later sub-project once its
  backing system exists.
- The website nav/IA change and legacy form retirement remain unrelated,
  unstarted sub-projects.
- Sub-project 1's own "Still open" note about this page (further up this
  file) is now resolved by this sub-project shipping — left as-is there per
  this project's own rule of not editing previously-written sections, noted
  here instead.

## Phase 5, sub-project 3 — Direct signed enquiry uploads

The Vercel request-size risk from sub-project 1 is resolved on the
`next-migration` preview. Attachment bytes no longer enter a Server Action: the
browser prepares a private upload session with text metadata, uploads each file
to a unique path in the private `enquiry-attachments` bucket, and sends only the
session capability and form text back for authoritative finalization.

### Upload implementation and deliberate deviation

The approved design first used Supabase signed TUS uploads. Hosted Storage
`1.77.5` rejected the correctly formed signed token it had issued with
`Invalid Compact JWS` (`ERR_JWS_INVALID`), matching the open upstream defect at
<https://github.com/supabase/storage/issues/1268>. With owner approval, the
shipping fallback uses `createSignedUploadUrl()` and one multipart `PUT` to that
exact path-scoped URL. Retry restarts only the failed file from byte zero;
completed files and form state remain intact. `tus-js-client` and the derived
direct-Storage endpoint were removed.

The server-only client supports the live project's modern `sb_secret_` key and
never serializes it to the browser. The service key and the separate HMAC
rate-limit secret are configured in Vercel Preview and Production. Preview also
needed the existing public Supabase URL and anon key added explicitly to both
environments before Server Actions could initialize.

### Session, verification and cleanup behavior

`enquiry_upload_sessions` binds a capability hash, expiry, status and normalized
manifest to random Storage paths. Preparation enforces three new sessions per
IP hash per rolling hour. Finalization verifies metadata and magic bytes before
one idempotent database function creates the client/enquiry/attachments and
completes the session transactionally.

Signature reads request only bytes `0-15`. Live preview testing found that
awaiting `ReadableStream.cancel()` after that range response could hang on
Vercel until the 300-second function timeout. Verification now requires a
bounded `206 Partial Content` response with matching range/length headers before
reading the tiny body with `arrayBuffer()`; a server that ignores or widens the
range is rejected before its body is buffered.

The deployed `cleanup-enquiry-upload-sessions` Edge Function and hourly Cron job
remove expired pending/failed objects before expiring their sessions. Its
project URL and modern secret are held in Supabase Vault/Edge Function secrets,
not in migrations. Cleanup was exercised against temporary live data and is
safe to retry.

### Deployed verification

The production-preview browser check used three owner-approved temporary live
submissions:

- a valid 10.2 MB PDF used one 10,695,782-byte Storage `PUT`; the largest Vercel
  POST was 1,413 bytes, progress was visible, and finalization completed;
- an interrupted upload exposed `Retry`, then succeeded through a second `PUT`
  without creating another session; and
- a PDF mutated after browser validation failed authoritative signature
  verification, created no enquiry, and left no Storage object.

The harness cleaned every temporary row/object in `finally`. A separate live
SQL check then reported zero matching sessions, enquiries, clients and Storage
objects. The complete repository gate passed before deployment.

### Cutover boundary and remaining work

The deferred permission-narrowing migration has **not** been applied. It must
wait until this branch serves production, then remove the legacy anonymous
Storage upload policy and direct public execution of `submit_enquiry()` only
after compatible production code is live. `main` still serves the legacy site,
and `/start-a-project` remains intentionally unlinked.

The separate OPS smoke test is still outstanding because it needs an owner-
supplied administrator login: submit one temporary enquiry, inspect both OPS
pages and its attachment/activity, confirm a malformed detail id returns 404,
then delete the test data.

## Phase 5, sub-project 4 - Clients module

The Clients area is the first complete read/write OPS module. It preserves the
existing `clients` table and ids while adding normalized contacts, richer account
metadata, atomic write functions, and `/ops/clients` create, read, update,
archive, and restore workflows.

### What's new

- `/ops/clients` now has the approved four summary counts, seven filters,
  contact-aware search, four sort modes, semantic detail/edit links, and a
  checkbox-selected preview with profile, contacts, recent enquiries, and
  client activity.
- `/ops/clients/new` and `/ops/clients/[id]/edit` share one controlled form for
  the client profile, repeatable preferred services, and multiple reorderable
  contacts. Exactly one contact is primary. Role/title is required for Company
  contacts and optional for Individuals.
- `/ops/clients/[id]` shows account overview, preferred services, linked
  Enquiries, relationship notes, client details, contacts, and client activity.
  Archive and restore require inline confirmation; restore email conflicts link
  to the active client that owns the address.
- Clients is enabled in the OPS sidebar for list, create, detail, and edit
  routes. Projects, Inbox, Follow-ups, Invoices, and Settings remain disabled.

### Data model and write boundary

Migration `20260929062412_clients_module.sql` adds account tier, industry,
region, client-since date, account overview, preferred services, and
relationship notes to `clients`. The new `client_contacts` table has admin-only
RLS, one active primary contact per client, and a case-insensitive unique email
index across non-archived contacts. Existing client email/contact/phone columns
remain as a compatibility mirror of the primary contact.

The migration backfills eligible existing clients and installs a narrow trigger
for legacy client inserts. OPS writes use admin-gated `SECURITY DEFINER`
functions for atomic create, edit, archive, and restore behavior. Those functions
write attributable entries to `ops_activity_log`; there is no client hard-delete
action in the application.

`submit_enquiry()` now matches active normalized contacts before the legacy
client email fallback. A newly created website client receives one primary
contact, while a matched enquiry only links the client and never overwrites its
saved profile or contacts.

### Deliberate scope and visual deviations

The reference screens include account ownership, projects, financial summaries,
communications, invoices, and follow-ups. None is rendered here because those
backing modules or staff model do not exist yet. Linked Enquiries are the only
cross-module records shown. Export, merge, bulk actions, and permanent deletion
also remain out of scope.

The visual treatment keeps the existing monochrome OPS tokens and uses plain
counts rather than unsupported trends. Narrow tables scroll horizontally. The
list follows the established Enquiries interaction: a checkbox controls one
inline preview, while navigation remains on real links.

### Verification and release boundary

The implementation has colocated schema, view-model, fetch, action, form,
directory, detail, archive/restore, and navigation tests. The complete repository
gate passes with 51 test files and 460 tests, followed by a successful Next.js
production build containing all four Clients routes.

The migration was verified in one rolled-back transaction against live project
`tscaluhtfrvwlwjybfsg`, then applied as remote migration
`20260929100353_clients_module`. The verification asserted the three-row legacy
backfill, preserved client ids and enquiry foreign keys, duplicate-email and
single-primary constraints, anon/non-admin denial, admin CRUD behavior, atomic
rollback on invalid updates, archive/restore semantics, secondary-contact
enquiry matching, and attributable activity entries. Post-apply inspection found
all expected columns, indexes, functions, policies, grants, and contact rows,
with no duplicate active email addresses or client missing exactly one primary
contact.

The project's default privileges grant function execution directly to API
roles, so revoking from `PUBLIC` alone left the three admin-gated client RPCs
and the trigger helper callable by `anon`. Additive migration
`20260929110500_restrict_clients_function_grants.sql` was verified in a rolled-
back transaction and applied remotely as
`20260929100926_restrict_clients_function_grants`. Anonymous execution is now
removed from all client write RPCs; authenticated and service-role execution is
retained for the admin-gated RPCs, and only the function owner can invoke the
trigger helper directly. Public execution of `submit_enquiry()` remains
intentional.

The post-migration security advisor no longer reports any anonymous Clients
function. Its authenticated warnings for the three client RPCs are expected:
each RPC independently checks `is_admin((select auth.uid()))`. The performance
advisor still reports the legacy `public_insert_lead` policy alongside admin
access on `clients`; that overlap is intentional while `main` still serves the
legacy lead forms required by the approved compatibility boundary. Other
advisor findings predate this module and remain outside its scope. No temporary
live client or enquiry rows were created during migration verification.

### Still open

- After deployment and explicit approval for temporary live rows, run the
  browser smoke test: create an Individual with two contacts, edit and switch
  the primary contact, verify duplicate blocking, archive/restore, inspect
  linked Enquiries and activity, then remove all temporary data.
- Add Projects, Invoices, Communications, and Follow-ups to the client record as
  each backing module ships.
- Add account ownership only after Settings supplies a real team/staff model.

## Phase 5, sub-project 5 - Projects module

The Projects area is now a production workspace rather than a legacy record
list. It adds an ordered five-stage active board, searchable terminal outcomes,
complete project records, structured plans, enquiry conversion, and focused
quick actions while preserving the existing `projects` table and legacy
relationships.

### Product surface

- `/ops/projects` has Active, Completed, On Hold, Cancelled, and Archived views;
  factual summary counts; search and production filters; a checkbox-selected
  preview; and an ordered kanban for Planning, Pre-Production, Production,
  Review, and Delivery.
- `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` provide pointer
  and keyboard movement. Every card also has an accessible Change stage menu;
  failed persistence restores the prior board and reports the error inline.
- `/ops/projects/[id]` provides Overview, Plan, and Activity views, project and
  client links, schedule/resources, a lightweight financial snapshot, ordered
  milestones/tasks/deliverables, and quick status controls. Archived projects
  are read-only until restored.
- `/ops/projects/new` supports standalone creation and conversion from an
  eligible enquiry. `/ops/projects/[id]/edit` reuses the controlled project and
  plan form. Projects is now enabled in the OPS navigation.

### Data model and compatibility

Migration `20260929123000_projects_module.sql` adds the production fields to
the existing `projects` table, including its canonical optional `enquiry_id`,
selected client contact, schedule, services, budget/payment/delivery state, and
ordered stage position. It adds admin-only milestone, task, and deliverable
tables with stable per-project ordering.

The preflight rejects legacy projects without a usable name/client or with an
unsupported status. Existing rows retain their ids, client and booking links.
The additive backfill maps controlled legacy types, chooses the first active
primary contact when available, copies booking date/location into empty
schedule fields, assigns deterministic stage positions, and creates at most one
ordered task or deliverable per non-empty line in the legacy text mirrors.
Project writes continue
to mirror type, brief, timeline, task titles, and deliverable titles into the
legacy columns so older readers remain compatible; booking remains read-only
context and is not rewritten by the module.

Enquiry conversion is one-way and atomic: a project owns the unique canonical
`enquiry_id`, the selected project client must match the enquiry client, and a
successful conversion marks the enquiry Booked. Later project movement only
synchronizes Production to `In Progress` and Completed to `Completed`; moving
backwards never rewinds an enquiry. Client previews/details now show linked
projects, while enquiry detail offers Create Project before conversion and Open
Project afterwards.

### Write and security boundary

Create, convert, update, move, quick-plan updates, archive, and restore each use
one admin-gated `SECURITY DEFINER` RPC. The RPCs validate relationships, lock
records needed for ordered movement, keep plan replacement atomic, and write
project-attributed activity. The migration explicitly revokes function access
from `public`, `anon`, `authenticated`, and `service_role` before granting only
the admin-gated public RPCs to `authenticated`; the contact-guard helper remains
owner-only. Child tables use admin-only RLS and direct anonymous project access
is revoked.

### Deliberate scope

The mockups' Owner, Files, Communication, and full Finance/Invoices panels are
deferred because Settings, file management, Inbox, and Invoices do not yet
provide backing systems. The financial view therefore shows only the project's
budget and current payment status. No dependencies on those future modules are
invented, and no project hard-delete action is exposed.

### Verification and release boundary

The implementation has colocated migration-domain, validation, view-model,
fetch, action, board, detail, form, integration, navigation, and migration-SQL
regression tests. The complete repository gate passes with 77 test files and
594 tests, followed by a successful Next.js production build containing all
four Projects routes.

The complete migration was first compiled against live schema and data inside a
rolled-back transaction. The full verification then exercised synthetic client,
contact, enquiry, project, milestone, task, deliverable, and activity records;
non-admin denial and zero-row RLS behavior; admin CRUD; invalid and atomic
payload handling; conversion and conflict behavior; ordered movement and
one-way enquiry status synchronization; quick actions; archive/restore; and
function/table ACLs. It ended at the exact live baseline of one project, three
clients, three contacts, zero enquiries, and 187 activity rows, with every
synthetic record and schema change removed.

That verification found and fixed two pre-apply defects in
`replace_project_plan()`: newly inserted plan rows were being mistaken for
stale rows and removed, and legacy task/deliverable mirrors used a literal
`\\n` separator instead of a newline. The regression test now fixes both
contracts in place.

Supabase applied the reviewed SQL as remote migration
`20260930072944_projects_module` to live project `tscaluhtfrvwlwjybfsg`.
Post-apply inspection found the original project id and count preserved, all 14
columns, three RLS-enabled child tables, four admin policies, eight public RPCs,
the owner-only helpers, contact guard, seven indexes, and no invalid contact or
duplicate enquiry relationships. The legacy project backfilled four ordered
tasks and no unsupported values. Anonymous execution is absent from every
Projects RPC; authenticated execution exists only for the functions that each
independently verify `is_admin((select auth.uid()))`.

The security advisor reports no new Projects-specific defect. Its authenticated
`SECURITY DEFINER` notices for the eight public Projects RPCs are expected from
their intentionally callable, internally admin-gated design. Fresh unused-index
notices are expected before production traffic. Remaining advisor findings
belong to pre-existing auth, gallery, upload-session, extension, and legacy
public-policy surfaces and remain outside this module.

Branch push, Vercel preview confirmation, and the owner-authenticated browser
smoke test remain the final release steps.

## Phase 5, sub-project 6 - Enquiry write flow

The Enquiries area now supports authenticated editing and status management rather than using its
status tabs as read-only labels. `/ops/enquiries/[id]` exposes Edit Enquiry and an explicit status
control; `/ops/enquiries/[id]/edit` updates contact and project-brief fields with the same limits as
the public submission form.

Status ownership is intentionally split. OPS admins manage New, Reviewing, Quoted, Follow-up, and
Closed. Project conversion remains the only path to Booked, and the linked Project remains the
owner of In Production and Completed. Once linked, the enquiry control is read-only and points to
the project. Source enquiry edits never rewrite the linked Client or Project.

Migration `20260930113000_enquiry_write_flow.sql` adds two atomic admin-gated RPCs. They validate
payloads, update the enquiry, and write changed-field or status-transition entries to
`ops_activity_log` in one transaction. Function execution is denied to anon and granted to
authenticated callers only after each RPC independently verifies `is_admin(auth.uid())`.

Qualification checklists, assignees, communications, follow-ups, opportunity data, manual enquiry
creation, export, and attachment mutation remain deferred to their backing modules or separate
scope.

The migration was compiled and exercised against the live schema inside a rolled-back transaction,
then applied as remote migration `20260930103719_enquiry_write_flow`. Post-apply verification
confirmed edit and status behavior, exactly matched activity writes, project-owned status rejection,
non-admin denial, explicit function grants, and complete rollback of the synthetic enquiry. The
security advisor reports no new anonymous Enquiry write function; its authenticated
`SECURITY DEFINER` notices are expected because both RPCs independently enforce the admin check.

## Phase 5, sub-project 7 - Follow-ups module

The Follow-ups area is the first OPS module that owns recurring work. It gives admins one queue of
scheduled internal actions anchored to a client and optionally to one enquiry or project, with
checklists, recurrence, a full lifecycle (complete, reschedule, cancel, reopen) and a scoped
activity history. Nothing is sent: contact methods are planning metadata only, and no email or
WhatsApp message is produced.

### What's new

- `/ops/follow-ups` has four metrics (Due Today, Overdue, Due This Week, Completed This Week), tabs
  for All, Due Today, Overdue, Upcoming, Completed and Cancelled, contact-aware search, five inline
  filter selects (client, type, priority, contact method, owner scope), four sort modes, and a
  checkbox-selected inline preview. Navigation stays on real links. Scheduling status is computed
  in `Africa/Johannesburg` and never stored. Open items sort ahead of history on the due-date and
  priority sorts, so old Completed and Cancelled rows do not bury live work.
- `/ops/follow-ups/new` and `/ops/follow-ups/[id]/edit` share one controlled form: client and
  contact, an optional enquiry or project limited to that client, type (with a custom label for
  Other), title, overview and notes, due date and time, priority, contact methods, a reorderable
  checklist editor, and a recurrence editor. Contextual entry points (`clientId` plus one of
  `enquiryId` or `projectId`) are re-validated on the server before anything is pre-selected, and
  archived records pre-fill nothing. Edit is offered only for Open follow-ups.
- `/ops/follow-ups/[id]` has Overview, Checklist and History tabs, a recurrence summary, and
  dialogs for Mark Complete (optional outcome, outstanding checklist count), Reschedule, Cancel
  (reason, plus skip-or-end-series for repeating work) and Reopen. Edit success redirects with a
  `?updated=1` flag that renders a calm notice.
- Follow-ups is enabled in the OPS sidebar without changing the approved order. The Client, Project
  and Enquiry detail pages gain linked-follow-up sections or tabs with Add Follow-up links, offered
  only for live (non-archived) records. They load through detail-page-only cached loaders, so the
  three edit pages never query follow-ups and a follow-ups outage cannot break an edit flow. On the
  detail pages a failed follow-ups read is the parent page's own failure state, not a silent empty
  list.

### Data and security

Migration `20260930141545_follow_ups_module.sql` is additive: three new tables (`follow_ups`,
`follow_up_series`, `follow_up_checklist_items`), a reference-number sequence, three owner-only
helpers, and seven admin-gated RPCs for create, update, complete, cancel, reopen, reschedule and
checklist-item toggle. No existing table is altered.

All three tables have RLS with a single admin-only SELECT policy and no policy for anon. `anon` has
no privileges at all, `authenticated` has SELECT only, and the sequence is revoked from `anon` and
`authenticated`. Every write goes through one of the seven `SECURITY DEFINER` RPCs. Each pins an
empty `search_path`, checks `is_admin((select auth.uid()))` first, and has EXECUTE revoked from
`public`, `anon` and `service_role` and granted to `authenticated` only. The helpers are executable
by nobody but the owner. RPCs validate that the contact, enquiry and project belong to the chosen
client, and write activity rows scoped with `collection = 'follow_ups'` and the follow-up UUID as
`record_id`, in the same transaction as the change.

Updates use optimistic `version` locking: a stale or NULL version returns `conflict`, never a silent
overwrite. The checklist order constraint is deferrable so reordering does not trip the unique
`sort_order` check, and every RPC takes locks in the same order (follow-up, series, items).

Applied to live project `tscaluhtfrvwlwjybfsg` on 2026-10-04 as live version `20261003233454`
(`follow_ups_module`). The repo filename carries the earlier stamp `20260930141545` because the
apply stamps the run time, the same drift as the earlier modules. Post-apply read-only inspection
confirmed three RLS-enabled tables, the expected grants, md5-identical function bodies, the
deferrable constraint, the new foreign-key indexes, and empty new tables with unchanged counts
elsewhere. Advisors reported exactly seven `authenticated_security_definer_function_executable`
WARNs (one per RPC, expected for the same reason as earlier modules) and 14 INFO unused-index notes
on the new, still-empty indexes. Nothing concerned anon, RLS or `search_path`.

### Recurrence model

- Only one current (Open) occurrence of a series exists at a time. Future occurrences are never
  materialized.
- Completing an occurrence, or cancelling it with the skip scope, creates exactly one successor in
  the same transaction, so an occurrence cannot finish without its successor. A retry of either
  action is idempotent and does not create a second successor.
- The app computes the candidate next date (RRULE via `rrule@2.8.1`, with Johannesburg-floating
  dates) and passes it to the RPC. Any COUNT in the rule is ignored when computing the next date.
  The database is the single authority on `ends_on` and `max_occurrences`, using the series'
  `occurrences_created` counter, so an "after N occurrences" series does not end early when an
  occurrence was rescheduled. A failed read of the next date is reported as an error rather than
  treated as "no next date", so a transient failure cannot silently end a series.
- Cancel has two scopes. `occurrence` skips the occurrence and continues the series. `series` ends
  the series with no successor. Edit also has two scopes: this occurrence only, or this and future
  occurrences, which updates the series defaults and the current record. Completed and Cancelled
  occurrences are never rewritten.
- Successors copy the client, related record, type, title, overview, notes, priority, contact
  methods and checklist labels, but not checklist completion or outcome.
- Monthly rules clamp to the last day of short months (a day-31 rule lands on the 30th or the 28th
  or 29th). Custom frequency means "every N days".

### Verification

The review process caught and fixed several defects before the migration was applied or any code
was pushed:

- Checklist reorder failed on the immediate unique `sort_order` constraint (now deferrable).
- A failed read of the next date silently killed a recurring series.
- `update_follow_up` could return `invalid` after already writing other changes, leaving a
  half-saved edit.
- Archived linked records blocked edits to existing follow-ups, contrary to the rule that archiving
  only blocks new ones.
- A NULL `p_version` bypassed the optimistic lock in every versioned RPC (now `is distinct from` in
  SQL plus integer validation in the actions).
- "After N occurrences" series ended early when an occurrence had been rescheduled.
- Reopen, removed checklist items and future-scope edits left no usable history. Reopen now records
  what it cleared, each removed checklist item gets its own row, and reschedule messages include
  times.

The SQL was verified twice in always-rolled-back transactions against the live schema. The final
run covered the edited migration with 240 named assertions, all passing, with all ten function
bodies md5-identical to the migration file. It covered admin versus non-admin and zero-row RLS
denial, CRUD, relation validation, the archived-edit exemption, checklist reorder, NULL and stale
version calls on all six versioned RPCs, every future-scope edit branch, standalone and recurring
lifecycle paths, idempotent retries, and reopen history. It also proved empirically that long
activity messages work: writes of 259, 226 and 319 characters succeeded because the RPCs are
`SECURITY DEFINER`, and the 200-character message limit exists only in the anon insert policy. Both
runs left nothing behind. Post-apply checks were read-only and passed. The repository gate was green
at the last commit with 1221 tests.

**Not yet verified.** The authenticated browser smoke test has not been run. It needs an admin
session and explicit approval before any temporary live rows are written. Until it runs, the
PostgREST foreign-key-hint selects (for example `clients!follow_ups_client_id_fkey`) and the three
related-follow-ups views on the Client, Project and Enquiry detail pages have only run against
mocks. The `<dialog>` `showModal()` path has only been exercised manually in Chromium, and screen
reader announcements are unverified.

### Deliberately different from the reference images and spec

- No Export, trend lines, select-all or bulk actions.
- No assignee UI. Every follow-up is owned by its creator and ownership is retained through every
  action.
- No Communication tab or snapshot and no invoice link, because Inbox and Invoices do not exist.
- A Cancelled tab was added to the reference's tabs.
- Five inline filter selects replace the reference's single Filter button.
- Stat cards do not click through to a filtered view, and rows have no overflow menu.
- The inline preview is leaner than the reference.
- Linked Records shows one of Enquiry or Project, since the spec allows one related record.
- Recent Activity lives in the History tab.
- Mark Complete, Reschedule and Cancel are separate buttons rather than one split control.
- Custom frequency means "every N days".

### Known limitations

- No UI path restarts an ended series (cancelled-series, `ends_on` or `max_occurrences` reached, or a
  reopened terminal occurrence). The SQL already reactivates a series on a this-and-future edit with
  recurrence on, so a later TypeScript-only fix is enough. It must handle `max_occurrences` already
  being reached. The Reopen dialog warns about this honestly.
- Reschedule is occurrence-only. The backend `future` reschedule path moves only the time of later
  occurrences, never the date pattern, so it is unexposed and the action schema is narrowed to
  `occurrence`.
- Monthly recurrence counts from the current due date. A manually rescheduled monthly occurrence can
  therefore skip a month. Daily and weekly rules snap back to their pattern. The fix is to step
  months from the series start.
- Completing an overdue daily or weekly item creates its successor from the old due date, so a late
  series stacks up already-overdue items.
- Successor occurrences copy the client and related record even if one has since been archived.
- Complete and cancel are idempotent on retry, but reopen, reschedule and checklist toggle return
  `conflict` when retried.
- Supabase's 1000-row read cap would silently truncate the list, metrics, related lists and form
  options once there are more than 1000 follow-ups. Pagination is deferred.
- Reopen clears the `outcome` and `cancellation_reason` columns. The history survives only in the
  activity log.
- A checklist toggle bumps the follow-up version, so an open edit form gets a conflict. This is
  documented behavior.
- The `?updated=1` "Follow-up updated" notice is not reliably announced after client-side
  navigation, and it reappears on a reload.
- "Completed by" is not shown on checklist items.
- The shared Tabs primitive has no arrow-key navigation.
- The recurrence summary prints a raw ISO end date.
- The pre-existing anon `public_insert_activity` policy allows forged `collection = 'follow_ups'`
  activity rows. Doing so needs a follow-up UUID, which is never exposed publicly.
- `update_follow_up` lacks create's contact-method and recurrence-payload re-checks. A crafted admin
  payload would raise a raw constraint error instead of `invalid`. The UI cannot produce such a
  payload.
- Removed-checklist-item and "updated" activity rows share one transaction timestamp, so their
  timeline order is unspecified without a tiebreaker.

### Still open

- Run the authenticated browser smoke test after explicit approval for temporary live rows: load the
  list, a detail page, all three related views and the edit form, exercise create, edit, complete,
  skip, cancel-series and reopen, then delete all temporary data.
- TypeScript-only follow-ups: month stepping from the series start, restarting an ended series, and a
  reliable announcement for the update notice.
- Communications and Inbox, the Invoices relation, team assignment, export, bulk actions, dashboard
  aggregation and pagination, each when its backing module or need arrives.
