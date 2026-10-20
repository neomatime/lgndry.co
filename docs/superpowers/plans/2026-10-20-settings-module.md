# Settings Module Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-20-settings-module-design.md`
**Branch:** `next-migration`
**Database:** live Supabase project `tscaluhtfrvwlwjybfsg`
**Delivery:** additive migration, verified in a rolled-back live transaction before application

## Codebase Findings

- `/ops/settings` does not exist and the Settings navigation item is intentionally disabled.
- OPS pages authenticate with `requireOpsUser()` before data access and render `EmptyState` for
  recoverable fetch failures.
- Existing feature folders separate schemas, pure shaping, server-only fetches, server actions,
  and client components. Settings will keep the same boundary even though it has one record.
- Existing writes use admin-gated `SECURITY DEFINER` RPCs and record collection-scoped events in
  `ops_activity_log`.
- The shared `Tabs` component already supplies keyboard-accessible tab semantics and can host the
  two approved settings sections without a new UI dependency.
- The existing LGNDRY.Co logo is available under `public/assests/logos/`; the feature needs only a
  read-only preview.
- There is no settings or commercial-default table to migrate. The new table and read policy are
  additive and do not alter existing production records.

## Locked Technical Decisions

### Singleton record

Create `public.ops_settings` with a fixed singleton UUID and a database check requiring that exact
ID. The table stores:

- Business identity: `workspace_name`, `company_email`, `company_phone`, `website_url`,
  `business_address`, and `registration_number`.
- Fixed locale: `time_zone = 'Africa/Johannesburg'` and `currency = 'ZAR'`.
- Commercial defaults: `default_quote_terms`, `default_retainer_percentage`,
  `default_quote_validity_days`, and `default_deposit_due_days`.
- Payment details: `bank_name`, `account_holder`, `account_number`, `branch_code`, `account_type`,
  and `payment_reference_instructions`.
- Email identity: `sender_name`, `sender_email`, and `reply_to_email`.
- Concurrency and attribution: `version`, `updated_by`, `created_at`, and `updated_at`.

The migration inserts the one approved seed row. Optional unknown values are empty strings, not
invented production data. A singleton check plus revoked direct writes prevents additional rows.

### Security and RPC contract

Enable RLS and grant authenticated users `SELECT` only. The select policy calls
`public.is_admin((select auth.uid()))`. `anon` receives no table privileges.

Create:

```sql
public.update_ops_settings(p_settings jsonb, p_expected_version integer) returns jsonb
```

The function uses `SECURITY DEFINER`, `set search_path = ''`, verifies admin access, locks the
singleton row, checks `version is distinct from p_expected_version`, validates every fixed/ranged
value, updates the row, increments its version, and adds the redacted activity message
`Workspace settings updated`. It returns one of:

```ts
{ status: "ok"; version: number }
{ status: "conflict"; version: number }
```

Revoke execute from `public`, `anon`, `authenticated`, and `service_role`, then grant execute only
to `authenticated`, matching the project's narrow application RPC rule. Never include submitted
settings in exception text or activity messages.

### Application contracts

Use `src/features/settings/` for the feature. The client-facing model uses camelCase and keeps
fixed locale fields in its read model but outside the editable payload.

```ts
type OpsSettings = {
  id: string;
  version: number;
  workspaceName: string;
  companyEmail: string;
  companyPhone: string;
  websiteUrl: string;
  businessAddress: string;
  registrationNumber: string;
  timeZone: "Africa/Johannesburg";
  currency: "ZAR";
  defaultQuoteTerms: string;
  defaultRetainerPercentage: number;
  defaultQuoteValidityDays: number;
  defaultDepositDueDays: number;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  paymentReferenceInstructions: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  updatedAt: string;
};
```

`fetchOpsSettings()` returns `{ status: "ok", settings }` or `{ status: "error" }`; it never
throws. `updateOpsSettings(input)` returns success, invalid, conflict, or error and revalidates
`/ops/settings` only after success.

## Task 1: Database Contract And Migration

**Create**

- `supabase/migrations/<generated>_ops_settings.sql`
- `src/features/settings/migration-sql.test.ts`

**Steps**

1. Generate the migration with the local Supabase CLI so its filename follows repository order.
2. Write failing static contract tests for the table columns, fixed singleton ID, seed defaults,
   singleton constraint, RLS, grants, admin read policy, and update RPC.
3. Implement the table and seed row. Use `numeric(5,2)` for the percentage, integer day fields,
   non-null text with safe defaults, and checks that mirror application bounds.
4. Implement `update_ops_settings` with a row lock, `is distinct from` optimistic comparison,
   strict JSON parsing, fixed locale enforcement, version increment, updater attribution, and one
   redacted activity event.
5. Test that the function has an empty search path, the admin guard runs before the write, direct
   writes are unavailable to authenticated users, and only authenticated receives execute.
6. Run the full gate:

   ```text
   pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```

## Task 2: Types, Validation, Mapping, Fetch, And Action

**Create**

- `src/features/settings/types.ts`
- `src/features/settings/schemas.ts`
- `src/features/settings/schemas.test.ts`
- `src/features/settings/settings-view-model.ts`
- `src/features/settings/settings-view-model.test.ts`
- `src/features/settings/fetch-ops-settings.ts`
- `src/features/settings/fetch-ops-settings.test.ts`
- `src/features/settings/actions.ts`
- `src/features/settings/actions.test.ts`

**Steps**

1. Define database-row, read-model, editable-input, and action-result types.
2. Implement the shared Zod schema. Normalize whitespace, lowercase email addresses, preserve
   multiline terms/address/payment instructions, allow approved blank optional fields, require
   workspace/sender names and three valid emails, enforce `http`/`https` websites, retainer
   `> 0 && <= 100`, and integer day counts from 1 through 365.
3. Keep row-to-model and model-to-RPC payload mapping pure and exhaustively tested, including null
   database values becoming empty form strings.
4. Implement `fetchOpsSettings()` as a server-only fetch. Select the fixed row with `.limit(2)`,
   require exactly one result, log database/shape failures with `console.error`, and return the
   established result contract.
5. Implement `updateOpsSettings()`: authenticate first, validate, call the RPC with the submitted
   version, parse its discriminated result, map stale writes to a calm conflict message, and
   revalidate the page after success.
6. Test authentication ordering, invalid input without database access, exact RPC payloads, success,
   stale version, malformed RPC data, returned errors, thrown errors, and revalidation.
7. Run the full gate.

## Task 3: Settings Form

**Create**

- `src/features/settings/components/settings-form.tsx`
- `src/features/settings/components/settings-form.test.tsx`

**Steps**

1. Build one controlled client form with two `Tabs`: General and Quotes & Invoices.
2. General renders Workspace Profile fields plus a read-only Brand & Identity section with the
   existing logo, `Africa/Johannesburg`, and `ZAR`.
3. Quotes & Invoices renders Quote Defaults, Payment Details, and Email Identity. Display plain
   supporting text that Resend credentials are maintained in Vercel; do not expose a secret field.
4. Use the existing visual language: square controls, restrained dividers, `ink` tokens, proper
   labels, no cards inside cards, wrapped long text, and no nested horizontal scrolling.
5. Track the last successfully loaded values. Discard restores them. Save validates locally,
   preserves submitted values on failure, focuses an accessible feedback region, and disables
   duplicate submission while pending.
6. On success, replace the local baseline and version with the returned/latest data and announce
   the save. On conflict, retain edits and offer a `Load current settings` button that calls
   `router.refresh()`; key the form by database version so refresh mounts the current record.
7. Test tab keyboard behavior, field labels, fixed read-only values, logo alt text, local validation,
   multiline fields, save payload, pending protection, success, error, conflict, discard, and
   feedback focus.
8. Run the full gate.

## Task 4: Route And Navigation Integration

**Create**

- `src/app/(app)/ops/settings/page.tsx`
- `src/app/(app)/ops/settings/page.test.tsx`

**Modify**

- `src/components/layout/ops-nav.tsx`
- `src/components/layout/ops-nav.test.tsx` if navigation coverage is colocated there; otherwise add
  the assertion to the nearest existing navigation test.

**Steps**

1. Add metadata title `Settings`.
2. Authenticate before calling `fetchOpsSettings()`.
3. Render `PageHeader` with the approved title and description.
4. Render a distinct temporarily-unavailable `EmptyState` on fetch failure; never fall back to
   fabricated settings.
5. Render `SettingsForm`, keyed by the settings version, on success.
6. Flip only Settings to `available: true` in the sidebar. Inbox and Invoices remain unavailable.
7. Test authentication ordering, error rendering, successful form rendering, metadata, navigation,
   active state, and mobile-width layout expectations.
8. Run the full gate.

## Task 5: Whole-Feature Review, Database Release, And Documentation

**Modify**

- `docs/architecture/application-architecture.md`
- `docs/superpowers/specs/2026-10-20-settings-module-design.md`

**Create temporarily, do not commit**

- A rolled-back SQL verification script under a gitignored temporary location.

**Steps**

1. Review every implementation file against the approved spec and `settings.png`. Remove any
   placeholder UI, accidental sensitive logging, unsupported controls, or hidden overflow.
2. Run an adversarial SQL review for RLS invisibility, direct-write grants, singleton bypass,
   null expected versions, malformed JSON casts, out-of-range numerics, and activity leakage.
3. Execute an always-rolled-back live verification against Supabase. Assert row counts for admin
   and non-admin reads; direct insert/update/delete rejection; valid update; exact version bump;
   stale and null version conflict; singleton enforcement; locale/range rejection; and redacted
   activity content.
4. Apply the additive migration to live Supabase only after verification passes. Confirm the
   migration history and seeded row without changing its values.
5. Run the full gate after migration application.
6. Update the architecture document with the table/RPC/UI decisions, deliberate omissions,
   migration identifier, verification results, and any remaining manual smoke-test gap.
7. Mark the spec Implemented only after code, database, and automated verification are complete.
8. Stage only the named Settings files, create a new commit, and push `next-migration`. Never stage
   unrelated images, OAuth files, scope documents, `supabase/.temp`, or verification artifacts.
9. Ask the owner to run the short authenticated manual verification from the spec. Do not write a
   live test value through tooling without explicit approval.
10. Run the full gate one final time before calling the module complete.

## Acceptance Checklist

- Settings is a working navigation destination with no placeholder tabs.
- Exactly one admin-readable settings row exists.
- All application writes use the versioned admin RPC.
- Sensitive values never appear in logs, activity messages, or client-side secrets.
- General and Quotes & Invoices sections persist every approved field.
- Terms are manually editable and future-document snapshot semantics are documented.
- Validation, discard, pending, success, failure, and stale-version states are accessible.
- The migration is verified in a rolled-back live transaction before application.
- All five gates pass and architecture notes match the shipped code.
