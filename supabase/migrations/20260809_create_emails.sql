-- LGNDRY.Co admin email portal.
-- Apply this migration to enable persistent email records in the Command Center.

create extension if not exists pgcrypto;

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  direction text not null default 'Incoming',
  status text not null default 'Inbox',
  priority text not null default 'Normal',
  client uuid references public.clients(id) on delete set null,
  project uuid references public.projects(id) on delete set null,
  "fromName" text,
  "fromEmail" text,
  "toName" text,
  "toEmail" text not null,
  cc text,
  category text not null default 'General',
  "receivedAt" date,
  "scheduledFor" date,
  owner text not null default 'Dan Mokgwadi',
  body text not null default '',
  "nextStep" text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists emails_status_idx on public.emails (status);
create index if not exists emails_client_idx on public.emails (client);
create index if not exists emails_project_idx on public.emails (project);
create index if not exists emails_received_at_idx on public.emails ("receivedAt" desc);

alter table public.emails enable row level security;

drop policy if exists "Admins can manage emails" on public.emails;
create policy "Admins can manage emails"
  on public.emails
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.emails to authenticated;
