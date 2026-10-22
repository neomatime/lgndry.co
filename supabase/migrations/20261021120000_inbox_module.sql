-- Threaded operational Inbox for the OPS Command Center.

begin;

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  display_name text not null default 'LGNDRY.Co',
  provider text not null default 'Titan IMAP + Resend',
  is_default boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index email_accounts_address_idx on public.email_accounts (lower(address));
create unique index email_accounts_one_default_idx
  on public.email_accounts (is_default) where is_default = true;

insert into public.email_accounts (address, display_name, is_default)
values ('neomokgwadi@lgndry-co.co.za', 'LGNDRY.Co', true);

create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.email_accounts(id) on delete restrict,
  subject text not null default '(No subject)',
  normalized_subject text not null default '',
  participant_emails text[] not null default '{}',
  participant_names text[] not null default '{}',
  snippet text not null default '',
  latest_message_at timestamptz not null default now(),
  message_count integer not null default 0 check (message_count >= 0),
  is_read boolean not null default false,
  is_starred boolean not null default false,
  archived_at timestamptz,
  trashed_at timestamptz,
  snoozed_until timestamptz,
  client_id uuid references public.clients(id) on delete set null,
  contact_id uuid references public.client_contacts(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  quote_id uuid references public.commercial_quotes(id) on delete set null,
  invoice_id uuid references public.commercial_invoices(id) on delete set null,
  follow_up_id uuid references public.follow_ups(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_threads_account_latest_idx
  on public.email_threads (account_id, latest_message_at desc);
create index email_threads_client_idx on public.email_threads (client_id);
create index email_threads_project_idx on public.email_threads (project_id);
create index email_threads_enquiry_idx on public.email_threads (enquiry_id);
create index email_threads_invoice_idx on public.email_threads (invoice_id);

alter table public.emails
  add column if not exists account_id uuid references public.email_accounts(id) on delete restrict,
  add column if not exists thread_id uuid references public.email_threads(id) on delete cascade,
  add column if not exists body_html text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists bcc text not null default '',
  add column if not exists message_id_header text,
  add column if not exists in_reply_to_header text,
  add column if not exists references_header text[] not null default '{}',
  add column if not exists sent_at timestamptz,
  add column if not exists is_read boolean not null default false,
  add column if not exists version integer not null default 1;

do $$
declare
  v_account_id uuid;
  v_email record;
  v_thread_id uuid;
  v_when timestamptz;
begin
  select id into v_account_id from public.email_accounts where is_default = true;

  for v_email in
    select * from public.emails where thread_id is null order by created_at, id
  loop
    v_when := coalesce(v_email.received_at, v_email."receivedAt"::timestamptz,
      v_email.sent_at, v_email.created_at);
    insert into public.email_threads (
      account_id, subject, normalized_subject, participant_emails, participant_names,
      snippet, latest_message_at, message_count, is_read, archived_at, client_id,
      project_id, created_at, updated_at
    ) values (
      v_account_id,
      coalesce(nullif(btrim(v_email.subject), ''), '(No subject)'),
      lower(regexp_replace(coalesce(v_email.subject, ''),
        '^\s*((re|fw|fwd)\s*:\s*)+', '', 'i')),
      array_remove(array[v_email."fromEmail", v_email."toEmail"], null),
      array_remove(array[v_email."fromName", v_email."toName"], null),
      left(regexp_replace(coalesce(v_email.body, ''), '\s+', ' ', 'g'), 240),
      v_when, 1, coalesce(v_email.is_read, false),
      case when coalesce(v_email.archived, false) then v_when else null end,
      v_email.client, v_email.project, v_email.created_at, v_email.updated_at
    ) returning id into v_thread_id;

    update public.emails
    set account_id = v_account_id,
        thread_id = v_thread_id,
        message_id_header = coalesce(message_id_header, provider_message_id),
        sent_at = case when direction = 'Outgoing' then coalesce(sent_at, created_at) else sent_at end
    where id = v_email.id;
  end loop;
end
$$;

alter table public.emails
  alter column account_id set not null,
  alter column thread_id set not null;

revoke insert, update, delete on public.emails from authenticated;
grant select on public.emails to authenticated;
grant select, insert, update, delete on public.emails to service_role;

create index emails_thread_time_idx
  on public.emails (thread_id, coalesce(received_at, sent_at, created_at));
create unique index emails_message_id_header_unique
  on public.emails (message_id_header) where message_id_header is not null;

create table public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  file_name text not null check (btrim(file_name) <> ''),
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 26214400),
  storage_path text,
  provider_attachment_id text,
  created_at timestamptz not null default now(),
  check (storage_path is not null or provider_attachment_id is not null)
);

create index email_attachments_email_idx on public.email_attachments (email_id);

create table if not exists public.email_sync_state (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null unique,
  last_uid bigint not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_sync_state
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create trigger set_updated_at before update on public.email_accounts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.email_threads
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.email_sync_state;
create trigger set_updated_at before update on public.email_sync_state
  for each row execute function public.set_updated_at();

alter table public.email_accounts enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_attachments enable row level security;
alter table public.email_sync_state enable row level security;

revoke all on public.email_accounts, public.email_threads, public.email_attachments,
  public.email_sync_state from public, anon;
grant select on public.email_accounts, public.email_threads, public.email_attachments,
  public.email_sync_state to authenticated, service_role;
grant insert, update, delete on public.email_accounts, public.email_threads,
  public.email_attachments, public.email_sync_state to service_role;

create policy admin_read on public.email_accounts for select to authenticated
  using (public.is_admin((select auth.uid())));
create policy admin_read on public.email_threads for select to authenticated
  using (public.is_admin((select auth.uid())));
create policy admin_read on public.email_attachments for select to authenticated
  using (public.is_admin((select auth.uid())));
create policy admin_read on public.email_sync_state for select to authenticated
  using (public.is_admin((select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-attachments', 'email-attachments', false, 26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
    'application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy email_attachments_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'email-attachments' and public.is_admin((select auth.uid())));
create policy email_attachments_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'email-attachments' and public.is_admin((select auth.uid())));
create policy email_attachments_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'email-attachments' and public.is_admin((select auth.uid())));

create or replace function public.set_email_thread_state(
  p_thread_id uuid,
  p_action text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.email_threads%rowtype;
  v_client_id uuid := nullif(p_links ->> 'client_id', '')::uuid;
  v_contact_id uuid := nullif(p_links ->> 'contact_id', '')::uuid;
  v_enquiry_id uuid := nullif(p_links ->> 'enquiry_id', '')::uuid;
  v_project_id uuid := nullif(p_links ->> 'project_id', '')::uuid;
  v_quote_id uuid := nullif(p_links ->> 'quote_id', '')::uuid;
  v_invoice_id uuid := nullif(p_links ->> 'invoice_id', '')::uuid;
  v_follow_up_id uuid := nullif(p_links ->> 'follow_up_id', '')::uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_thread from public.email_threads where id = p_thread_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if p_expected_version is null or v_thread.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', v_thread.version);
  end if;
  if p_action not in ('mark-read', 'mark-unread', 'star', 'unstar', 'archive',
    'restore', 'trash') then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.email_threads set
    is_read = case p_action when 'mark-read' then true when 'mark-unread' then false else is_read end,
    is_starred = case p_action when 'star' then true when 'unstar' then false else is_starred end,
    archived_at = case p_action when 'archive' then now() when 'restore' then null else archived_at end,
    trashed_at = case p_action when 'trash' then now() when 'restore' then null else trashed_at end,
    version = version + 1
  where id = p_thread_id;

  update public.emails set is_read = case p_action
    when 'mark-read' then true when 'mark-unread' then false else is_read end
  where thread_id = p_thread_id;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Email thread ' || replace(p_action, '-', ' '), 'email_threads', p_thread_id,
    replace(p_action, '-', '_'));
  return jsonb_build_object('status', 'ok', 'version', v_thread.version + 1);
end;
$$;

create or replace function public.link_email_thread(
  p_thread_id uuid,
  p_links jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.email_threads%rowtype;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_thread from public.email_threads where id = p_thread_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if p_expected_version is null or v_thread.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', v_thread.version);
  end if;
  if v_client_id is null and coalesce(
    v_contact_id, v_enquiry_id, v_project_id, v_quote_id, v_invoice_id, v_follow_up_id
  ) is not null then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'Choose the client before linking related records.'
    );
  end if;
  if v_client_id is not null and not exists (
    select 1 from public.clients where id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The selected client is unavailable.');
  end if;
  if v_contact_id is not null and not exists (
    select 1 from public.client_contacts
    where id = v_contact_id and client_id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The contact does not belong to that client.');
  end if;
  if v_enquiry_id is not null and not exists (
    select 1 from public.enquiries where id = v_enquiry_id and client_id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The enquiry does not belong to that client.');
  end if;
  if v_project_id is not null and not exists (
    select 1 from public.projects where id = v_project_id and client_id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The project does not belong to that client.');
  end if;
  if v_quote_id is not null and not exists (
    select 1 from public.commercial_quotes where id = v_quote_id and client_id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The quote does not belong to that client.');
  end if;
  if v_invoice_id is not null and not exists (
    select 1 from public.commercial_invoices where id = v_invoice_id and client_id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The invoice does not belong to that client.');
  end if;
  if v_follow_up_id is not null and not exists (
    select 1 from public.follow_ups where id = v_follow_up_id and client_id = v_client_id
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The follow-up does not belong to that client.');
  end if;
  update public.email_threads set
    client_id = v_client_id,
    contact_id = v_contact_id,
    enquiry_id = v_enquiry_id,
    project_id = v_project_id,
    quote_id = v_quote_id,
    invoice_id = v_invoice_id,
    follow_up_id = v_follow_up_id,
    version = version + 1
  where id = p_thread_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Email thread links updated', 'email_threads', p_thread_id, 'linked');
  return jsonb_build_object('status', 'ok', 'version', v_thread.version + 1);
end;
$$;

create or replace function public.save_email_draft(
  p_email_id uuid,
  p_thread_id uuid,
  p_payload jsonb,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_thread public.email_threads%rowtype;
  v_email public.emails%rowtype;
  v_thread_id uuid := p_thread_id;
  v_email_id uuid := p_email_id;
  v_subject text := coalesce(nullif(btrim(p_payload ->> 'subject'), ''), '(No subject)');
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if nullif(btrim(p_payload ->> 'to_email'), '') is null then
    return jsonb_build_object('status', 'invalid', 'message', 'A recipient is required.');
  end if;
  select id into v_account_id from public.email_accounts where is_default = true;
  if v_thread_id is null then
    insert into public.email_threads (
      account_id, subject, normalized_subject, participant_emails, participant_names,
      snippet, latest_message_at, message_count, is_read
    ) values (
      v_account_id, v_subject,
      lower(regexp_replace(v_subject, '^\s*((re|fw|fwd)\s*:\s*)+', '', 'i')),
      array[lower(btrim(p_payload ->> 'to_email'))],
      array_remove(array[nullif(btrim(p_payload ->> 'to_name'), '')], null),
      left(regexp_replace(coalesce(p_payload ->> 'body', ''), '\s+', ' ', 'g'), 240),
      now(), 0, true
    ) returning id into v_thread_id;
  else
    select * into v_thread from public.email_threads where id = v_thread_id for update;
    if not found then return jsonb_build_object('status', 'not-found'); end if;
    if p_email_id is null and (
      p_expected_version is null or v_thread.version <> p_expected_version
    ) then
      return jsonb_build_object('status', 'conflict', 'version', v_thread.version);
    end if;
  end if;

  if v_email_id is null then
    insert into public.emails (
      account_id, thread_id, subject, direction, status, priority, "fromName", "fromEmail",
      "toName", "toEmail", cc, bcc, category, owner, body, body_html, archived, is_read
    ) values (
      v_account_id, v_thread_id, v_subject, 'Outgoing', 'Draft', 'Normal', 'LGNDRY.Co',
      'neomokgwadi@lgndry-co.co.za', nullif(btrim(p_payload ->> 'to_name'), ''),
      lower(btrim(p_payload ->> 'to_email')), coalesce(p_payload ->> 'cc', ''),
      coalesce(p_payload ->> 'bcc', ''), 'General',
      coalesce(nullif(btrim(p_payload ->> 'owner'), ''), 'LGNDRY.Co'),
      coalesce(p_payload ->> 'body', ''), nullif(p_payload ->> 'body_html', ''), false, true
    ) returning id into v_email_id;
  else
    select * into v_email from public.emails where id = v_email_id for update;
    if not found or v_email.status <> 'Draft' then
      return jsonb_build_object('status', 'not-found');
    end if;
    if p_expected_version is null or v_email.version <> p_expected_version then
      return jsonb_build_object('status', 'conflict', 'version', v_email.version);
    end if;
    update public.emails set subject = v_subject,
      "toName" = nullif(btrim(p_payload ->> 'to_name'), ''),
      "toEmail" = lower(btrim(p_payload ->> 'to_email')),
      cc = coalesce(p_payload ->> 'cc', ''), bcc = coalesce(p_payload ->> 'bcc', ''),
      body = coalesce(p_payload ->> 'body', ''),
      body_html = nullif(p_payload ->> 'body_html', ''), version = version + 1,
      updated_at = now()
    where id = v_email_id;
  end if;

  update public.email_threads set subject = v_subject,
    normalized_subject = lower(regexp_replace(v_subject,
      '^\s*((re|fw|fwd)\s*:\s*)+', '', 'i')),
    snippet = left(regexp_replace(coalesce(p_payload ->> 'body', ''), '\s+', ' ', 'g'), 240),
    latest_message_at = now(),
    message_count = (select count(*) from public.emails where thread_id = v_thread_id),
    version = version + 1
  where id = v_thread_id;
  select version into v_email.version from public.emails where id = v_email_id;
  return jsonb_build_object(
    'status', 'ok',
    'thread_id', v_thread_id,
    'email_id', v_email_id,
    'version', v_email.version
  );
end;
$$;

create or replace function public.delete_email_draft(
  p_email_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email public.emails%rowtype;
  v_thread_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_email from public.emails where id = p_email_id for update;
  if not found or v_email.status <> 'Draft' then
    return jsonb_build_object('status', 'not-found');
  end if;
  if p_expected_version is null or v_email.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', v_email.version);
  end if;
  v_thread_id := v_email.thread_id;
  delete from public.emails where id = p_email_id;
  if not exists (select 1 from public.emails where thread_id = v_thread_id) then
    delete from public.email_threads where id = v_thread_id;
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.register_email_attachment(
  p_email_id uuid,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_storage_path text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email public.emails%rowtype;
  v_attachment_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_email from public.emails where id = p_email_id for update;
  if not found or v_email.status <> 'Draft' then
    return jsonb_build_object('status', 'not-found');
  end if;
  if p_expected_version is null or v_email.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', v_email.version);
  end if;
  if nullif(btrim(p_file_name), '') is null
     or p_content_type not in (
       'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
       'application/zip',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     )
     or p_size_bytes <= 0 or p_size_bytes > 26214400
     or p_storage_path not like v_email.thread_id::text || '/' || p_email_id::text || '/%' then
    return jsonb_build_object('status', 'invalid');
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'email-attachments' and name = p_storage_path
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'The upload could not be verified.');
  end if;
  insert into public.email_attachments (
    email_id, file_name, content_type, size_bytes, storage_path
  ) values (
    p_email_id, btrim(p_file_name), p_content_type, p_size_bytes, p_storage_path
  ) returning id into v_attachment_id;
  update public.emails set version = version + 1, updated_at = now() where id = p_email_id;
  return jsonb_build_object(
    'status', 'ok',
    'attachment_id', v_attachment_id,
    'version', v_email.version + 1
  );
end;
$$;

revoke all on function public.set_email_thread_state(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.link_email_thread(uuid, jsonb, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.save_email_draft(uuid, uuid, jsonb, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_email_draft(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.register_email_attachment(uuid, text, text, bigint, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.set_email_thread_state(uuid, text, integer) to authenticated;
grant execute on function public.link_email_thread(uuid, jsonb, integer) to authenticated;
grant execute on function public.save_email_draft(uuid, uuid, jsonb, integer) to authenticated;
grant execute on function public.delete_email_draft(uuid, integer) to authenticated;
grant execute on function public.register_email_attachment(uuid, text, text, bigint, text, integer)
  to authenticated;

commit;
