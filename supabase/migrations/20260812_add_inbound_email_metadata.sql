-- Stores the provider identifiers needed to safely ingest inbound email webhooks.
-- The portal remains admin-only through the existing emails RLS policy.

alter table public.emails
  add column if not exists provider text not null default 'Manual',
  add column if not exists provider_email_id text,
  add column if not exists provider_message_id text,
  add column if not exists received_at timestamptz;

create unique index if not exists emails_provider_email_id_unique
  on public.emails (provider_email_id)
  where provider_email_id is not null;

create index if not exists emails_received_at_timestamp_idx
  on public.emails (received_at desc);
