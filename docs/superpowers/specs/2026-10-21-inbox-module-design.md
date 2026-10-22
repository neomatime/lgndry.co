# Inbox Module Design

**Date:** 2026-10-21
**Status:** Approved by existing owner decisions and reference design

## Goal

Replace the disabled Inbox navigation item with a production-ready operational mailbox that mirrors
`docs/design-references/inbox.png` and connects email conversations to the Command Center's client,
enquiry, project, quote, invoice, and follow-up records.

## First Complete Release

The first release is a real mailbox, not a static message viewer. It includes:

- a four-pane desktop layout: folders, thread list, conversation, and operational context;
- responsive pane navigation on smaller screens;
- Inbox, All Mail, Unread, Starred, Sent, Drafts, Archive, and Trash views with counts;
- text search across participants, subject, message body, and linked record names;
- conversation threading using provider Message-ID, In-Reply-To, and References headers;
- read/unread, star/unstar, archive, restore, and trash actions;
- compose, reply, save draft, edit draft, discard draft, and send;
- CC/BCC, plain-text content, browser spellcheck, multiple attachments, and the configured signature;
- direct browser-to-Storage attachment uploads so Vercel request limits are not involved;
- automatic contact/client matching by email, with explicit links to operational records;
- the right rail shown in the reference: client/contact, project, related records, attachments,
  follow-ups, and notes when those records exist;
- authenticated manual Inbox sync with a clear last-sync state;
- activity-log entries for material mailbox actions.

The implementation continues to use Titan/GoDaddy over IMAP for inbound synchronization and Resend
for authenticated outbound mail. Provider-specific behavior remains behind Edge Functions and is not
spread through React components.

## Deliberate Deferrals

The following do not block a useful, complete first release:

- multiple connected mailboxes and alternate sending identities;
- scheduled send, undo send, snooze, spam/phishing reporting, and provider-side rules;
- custom label management, templates, vacation responders, forwarding, and offline mode;
- rich-text authoring and inline images;
- provider-side advanced search operators;
- bulk mailbox actions and pagination beyond the current low-volume operating scale.

The database is shaped so multiple accounts, labels, and scheduled actions can be added later without
replacing the Inbox UI or message/thread model.

## Data Model

### `email_accounts`

Stores non-secret mailbox metadata. The first row represents the existing Titan mailbox. Secrets stay
in Supabase Edge Function secrets.

### `email_threads`

Stores mailbox state and operational links:

- subject, normalized subject, participants, snippet, latest message time, message count;
- unread, starred, archived, trashed, and snoozed state;
- optional client, contact, enquiry, project, quote, invoice, and follow-up links;
- optimistic `version` locking.

### Existing `emails`

The legacy table remains the message store for compatibility and gains:

- account and thread references;
- provider header fields required for threading;
- HTML/plain body support, message timestamps, read state, and attachment metadata;
- draft/sent state needed by compose and reply.

Existing rows are preserved and receive a thread during migration.

### `email_attachments`

Stores safe attachment metadata and private Storage paths. Files live in a private
`email-attachments` bucket and are exposed through short-lived signed URLs.

## Security

- Pages call `requireOpsUser()` before data access.
- Tables use admin-only RLS.
- Mutations use admin-gated `SECURITY DEFINER` RPCs with an empty `search_path` and optimistic locking.
- RPC execution is granted only to `authenticated`, never `anon`, `public`, or `service_role`.
- Sending remains authenticated in `send-admin-email`; it never trusts a caller-supplied sender.
- Attachment upload sessions use short-lived signed paths and server verification before association.
- Message HTML is rendered only in a sandboxed iframe; plain text is the default composer format.
- OAuth files in the repository root are unrelated and must never be staged.

## Data Loading And Failure States

- Server-only fetchers catch and log Supabase failures and return explicit result states.
- The Inbox page renders a distinct temporarily-unavailable state on read failures.
- The thread list and selected thread are fetched independently enough that an invalid selection can
  fall back to the newest visible thread.
- Dates in client components use `Africa/Johannesburg` and a server-provided `now`.

## Interaction And Layout

- Desktop follows the supplied design closely, with stable pane widths and no visible nested
  horizontal scrollbar.
- Thread selection is URL-backed (`?thread=`), allowing refresh and browser navigation.
- Folder selection is URL-backed (`?folder=`).
- Keyboard-focusable controls use icons with accessible names and tooltips.
- On narrow screens, users move between thread list, conversation, and context without squeezing all
  panes into an unusable canvas.
- Empty folders, empty searches, and an empty mailbox each have specific empty states.

## Integration Rules

- Incoming sender addresses match active `client_contacts` case-insensitively.
- Matching links the thread to the contact and client only; business records are never created
  automatically.
- Users can explicitly associate or remove enquiry, project, quote, invoice, and follow-up links.
- Email snapshots on other modules remain a follow-on integration task after the Inbox itself ships.

## Verification

- Unit tests cover normalization, folder filtering, counts, search, thread shaping, schemas, and action
  error mapping.
- Component tests cover folder selection, thread selection, mailbox actions, compose/draft/send, and
  responsive navigation.
- Fetch tests mock `@/lib/db/server` and assert distinct unavailable states.
- Migration tests assert RLS, grants, constraints, optimistic locking, and legacy-row backfill.
- The full gate is required: format, typecheck, lint, tests, and build.
- SQL is verified in an always-rolled-back transaction before it is applied to the live project.
