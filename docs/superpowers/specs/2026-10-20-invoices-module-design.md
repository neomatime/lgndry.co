# Invoices and Quotes Module

## Objective

Build the OPS commercial workflow without turning the Command Center into accounting software.
The module must preserve the supplied `invoices.png` and `view-invoice.png` composition while
supporting the studio's real path from quote to paid booking.

## Locked Decisions

- Currency is ZAR only and LGNDRY.Co is not VAT registered.
- Quotes and invoices are separate, permanent records.
- Drafts are editable. Issued records are immutable; changes create a revision.
- The client action is **Approve Quote**. Clients cannot reverse approval.
- Approval automatically creates a deposit invoice using the quote's snapshotted retainer rate.
- A booking is confirmed only after the deposit invoice is fully paid.
- Full deposit payment automatically creates the linked project in Planning and marks the source
  enquiry Booked. Duplicate projects are prevented.
- Discounts are explicit document-level ZAR amounts.
- Issued documents snapshot business identity, terms, bank details, currency, validity and due-day
  defaults from Settings. Later Settings changes never rewrite issued documents.
- Payments are recorded manually in this phase. No gateway, VAT calculation, recurring billing or
  full accounting ledger is included.

## Information Model

- `commercial_quotes` and ordered `commercial_quote_line_items`.
- `commercial_invoices`, ordered `commercial_invoice_line_items`, and append-only
  `commercial_payments`.
- Quotes link to a client and contact, and optionally to one enquiry or project.
- Invoices link to their source quote and carry the same client context.
- Every document has a human reference, optimistic version, owner snapshot and activity trail.
- A sent quote stores only a SHA-256 approval-token hash. The raw token appears only in the email
  URL.

## Workflow

1. Staff creates and edits a quote draft.
2. Send validates commercial Settings, snapshots them, freezes the quote, and emails a private
   approval link.
3. The client reviews the quote and presses **Approve Quote**.
4. Approval is atomic and idempotent, records the approver and timestamp, and creates one deposit
   invoice.
5. Staff records one or more payments. Partial payments do not book the work.
6. When the deposit invoice is fully paid, the database creates or reuses the linked project,
   updates project payment status, marks the enquiry Booked, and records activity.

## OPS Experience

- `/ops/invoices` matches the reference: header actions, four metrics, status tabs, search/sort,
  full-width dense table, selected-row highlight and lower preview panels.
- `/ops/invoices/[id]` matches the detail reference with summary cards, tabs, billing summary,
  line items, payment history, linked records, collection follow-up and activity.
- `/ops/invoices/quotes` lists quote records and provides New Quote.
- Draft create/edit screens use a client-first form with repeatable line items and live ZAR totals.
- `/quote/[token]` is a restrained public review and approval page; invalid or expired links reveal
  no client data.

## Security

- OPS reads require `requireOpsUser()` and admin RLS.
- All writes use admin-gated `SECURITY DEFINER` RPCs with empty `search_path`, restricted EXECUTE
  grants and optimistic locking.
- Public quote read/approval uses narrowly scoped token-hash RPCs. It exposes one sent quote only,
  never table access.
- Issued financial records are never hard-deleted.

## Error and Empty States

- Fetch functions return result types and never throw.
- Pages distinguish not-found, temporarily unavailable and empty states.
- Send, approval and payment operations are idempotent and return clear conflict/invalid results.

