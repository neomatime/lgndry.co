-- Private upload sessions for direct, resumable Start a Project attachments.
-- Public visitors never access this table or these functions directly. The
-- Next.js server uses the service role to prepare, verify, and finalize a
-- session without proxying attachment bytes through Vercel.

create table public.enquiry_upload_sessions (
  id uuid primary key,
  ip_hash text not null check (length(ip_hash) = 64),
  client_secret_hash text not null check (length(client_secret_hash) = 64),
  status text not null default 'pending'
    check (status in ('pending', 'finalizing', 'completed', 'failed', 'expired')),
  file_manifest jsonb not null default '[]'::jsonb
    check (jsonb_typeof(file_manifest) = 'array')
    check (jsonb_array_length(file_manifest) <= 5),
  enquiry_id uuid unique references public.enquiries (id) on delete set null,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.enquiry_upload_sessions
  for each row execute function public.set_updated_at();

create index enquiry_upload_sessions_rate_limit_idx
  on public.enquiry_upload_sessions (ip_hash, created_at desc);

create index enquiry_upload_sessions_cleanup_idx
  on public.enquiry_upload_sessions (expires_at)
  where status in ('pending', 'failed');

alter table public.enquiry_upload_sessions enable row level security;

revoke all on public.enquiry_upload_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.enquiry_upload_sessions to service_role;

create or replace function public.create_enquiry_upload_session(
  p_session_id uuid,
  p_ip_hash text,
  p_client_secret_hash text,
  p_file_manifest jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry jsonb;
begin
  if length(p_ip_hash) <> 64 or length(p_client_secret_hash) <> 64 then
    raise exception using errcode = '22023', message = 'invalid_upload_session_hash';
  end if;

  if jsonb_typeof(p_file_manifest) <> 'array'
     or jsonb_array_length(p_file_manifest) > 5 then
    raise exception using errcode = '22023', message = 'invalid_upload_manifest';
  end if;

  for entry in select value from jsonb_array_elements(p_file_manifest)
  loop
    if jsonb_typeof(entry) <> 'object'
       or coalesce(entry ->> 'storage_path', '') = ''
       or not starts_with(entry ->> 'storage_path', p_session_id::text || '/')
       or coalesce(entry ->> 'file_name', '') = ''
       or coalesce(entry ->> 'mime_type', '') not in (
         'application/pdf',
         'image/jpeg',
         'image/png',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
       )
       or jsonb_typeof(entry -> 'size_bytes') <> 'number'
       or (entry ->> 'size_bytes')::bigint <= 0
       or (entry ->> 'size_bytes')::bigint > 15728640 then
      raise exception using errcode = '22023', message = 'invalid_upload_manifest';
    end if;
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0));

  if (
    select count(*)
    from public.enquiry_upload_sessions s
    where s.ip_hash = p_ip_hash
      and s.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'upload_rate_limit_exceeded';
  end if;

  insert into public.enquiry_upload_sessions (
    id,
    ip_hash,
    client_secret_hash,
    file_manifest,
    expires_at
  )
  values (
    p_session_id,
    p_ip_hash,
    p_client_secret_hash,
    p_file_manifest,
    now() + interval '24 hours'
  );

  return p_session_id;
end;
$$;

create or replace function public.get_enquiry_upload_session(p_session_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'client_secret_hash', s.client_secret_hash,
    'status', s.status,
    'file_manifest', s.file_manifest,
    'enquiry_id', s.enquiry_id,
    'expires_at', s.expires_at
  )
  from public.enquiry_upload_sessions s
  where s.id = p_session_id;
$$;

create or replace function public.mark_enquiry_upload_session_failed(p_session_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.enquiry_upload_sessions
  set status = 'failed'
  where id = p_session_id
    and status in ('pending', 'finalizing');

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.list_expired_enquiry_upload_sessions(
  p_limit integer default 50
)
returns table (id uuid, file_manifest jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.file_manifest
  from public.enquiry_upload_sessions s
  where s.status in ('pending', 'failed')
    and s.expires_at <= now()
  order by s.expires_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.mark_enquiry_upload_session_expired(p_session_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.enquiry_upload_sessions
  set status = 'expired'
  where id = p_session_id
    and status in ('pending', 'failed')
    and expires_at <= now();

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.finalize_enquiry_upload_session(
  p_session_id uuid,
  p_full_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_project_type text,
  p_location text,
  p_timeline text,
  p_description text,
  p_budget text,
  p_client_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_row public.enquiry_upload_sessions%rowtype;
  new_enquiry_id uuid;
  expected_count integer;
  inserted_count integer;
begin
  select * into session_row
  from public.enquiry_upload_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'upload_session_not_found';
  end if;

  if session_row.status = 'completed' then
    return jsonb_build_object(
      'enquiry_id', session_row.enquiry_id,
      'created', false
    );
  end if;

  if session_row.status not in ('pending', 'finalizing') then
    raise exception using errcode = 'P0001', message = 'upload_session_not_finalizable';
  end if;

  if session_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'upload_session_expired';
  end if;

  update public.enquiry_upload_sessions
  set status = 'finalizing'
  where id = p_session_id;

  new_enquiry_id := public.submit_enquiry(
    p_full_name,
    p_company,
    p_email,
    p_phone,
    p_project_type,
    p_location,
    p_timeline,
    p_description,
    p_budget,
    p_client_notes,
    session_row.file_manifest
  );

  expected_count := jsonb_array_length(session_row.file_manifest);

  select count(*) into inserted_count
  from public.enquiry_attachments a
  where a.enquiry_id = new_enquiry_id;

  if inserted_count <> expected_count then
    raise exception using errcode = 'P0001', message = 'attachment_manifest_mismatch';
  end if;

  update public.enquiry_upload_sessions
  set
    status = 'completed',
    enquiry_id = new_enquiry_id,
    finalized_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'enquiry_id', new_enquiry_id,
    'created', true
  );
end;
$$;

revoke all on function public.create_enquiry_upload_session(uuid, text, text, jsonb)
  from public;
revoke all on function public.get_enquiry_upload_session(uuid) from public;
revoke all on function public.mark_enquiry_upload_session_failed(uuid) from public;
revoke all on function public.list_expired_enquiry_upload_sessions(integer) from public;
revoke all on function public.mark_enquiry_upload_session_expired(uuid) from public;
revoke all on function public.finalize_enquiry_upload_session(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_enquiry_upload_session(uuid, text, text, jsonb)
  to service_role;
grant execute on function public.get_enquiry_upload_session(uuid) to service_role;
grant execute on function public.mark_enquiry_upload_session_failed(uuid) to service_role;
grant execute on function public.list_expired_enquiry_upload_sessions(integer)
  to service_role;
grant execute on function public.mark_enquiry_upload_session_expired(uuid)
  to service_role;
grant execute on function public.finalize_enquiry_upload_session(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

-- submit_enquiry currently remains available to anon/authenticated until the
-- compatible production deployment is live. The service role also needs this
-- grant because finalize_enquiry_upload_session invokes it as SECURITY INVOKER.
grant execute on function public.submit_enquiry(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to service_role;
