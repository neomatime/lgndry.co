-- Client relationship model for the OPS Command Center.
-- Additive and compatible with the legacy admin/public lead forms.

begin;

do $$
begin
  if exists (
    select 1 from public.clients
    where status is not null and status not in ('Lead', 'Active', 'At Risk', 'Inactive')
  ) then
    raise exception 'clients contain unsupported status values';
  end if;
  if exists (
    select 1 from public.clients
    where type is not null and type not in ('Company', 'Individual')
  ) then
    raise exception 'clients contain unsupported type values';
  end if;
  if exists (
    select lower(btrim(email))
    from public.clients
    where archived = false and coalesce(btrim(email), '') <> ''
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'active clients contain duplicate email addresses';
  end if;
end
$$;

alter table public.clients
  add column account_tier text not null default 'Standard',
  add column industry text,
  add column region text,
  add column client_since date,
  add column account_overview text,
  add column preferred_services text[] not null default '{}',
  add column relationship_notes text;

update public.clients
set
  client_since = coalesce(client_since, created_at::date),
  relationship_notes = coalesce(relationship_notes, notes);

alter table public.clients
  alter column client_since set default current_date,
  alter column client_since set not null,
  add constraint clients_account_tier_check
    check (account_tier in ('Standard', 'Key Account')),
  add constraint clients_status_check
    check (status is null or status in ('Lead', 'Active', 'At Risk', 'Inactive')),
  add constraint clients_type_check
    check (type is null or type in ('Company', 'Individual'));

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  full_name text not null check (btrim(full_name) <> ''),
  role_title text,
  email text not null check (btrim(email) <> ''),
  phone text,
  is_primary boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.client_contacts
  for each row execute function public.set_updated_at();

create index client_contacts_client_id_idx on public.client_contacts (client_id);
create unique index client_contacts_active_email_idx
  on public.client_contacts (lower(btrim(email))) where archived = false;
create unique index client_contacts_one_active_primary_idx
  on public.client_contacts (client_id) where is_primary = true and archived = false;

alter table public.client_contacts enable row level security;
revoke all on public.client_contacts from public, anon;
grant select, insert, update, delete on public.client_contacts to authenticated, service_role;

create policy admin_full_access on public.client_contacts
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

insert into public.client_contacts (
  client_id, full_name, role_title, email, phone, is_primary, archived, created_at, updated_at
)
select
  c.id,
  case
    when lower(coalesce(btrim(c.contact), '')) in ('', 'main', 'primary', 'n/a', '-')
      then coalesce(nullif(btrim(c.name), ''), btrim(c.email))
    else btrim(c.contact)
  end,
  null,
  btrim(c.email),
  nullif(btrim(c.phone), ''),
  true,
  c.archived,
  c.created_at,
  c.updated_at
from public.clients c
where coalesce(btrim(c.email), '') <> '';

create or replace function public.create_primary_contact_for_legacy_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(btrim(new.email), '') <> '' then
    insert into public.client_contacts (
      client_id, full_name, email, phone, is_primary, archived
    ) values (
      new.id,
      case
        when lower(coalesce(btrim(new.contact), '')) in ('', 'main', 'primary', 'n/a', '-')
          then coalesce(nullif(btrim(new.name), ''), btrim(new.email))
        else btrim(new.contact)
      end,
      btrim(new.email),
      nullif(btrim(new.phone), ''),
      true,
      new.archived
    );
  end if;
  return new;
end;
$$;

revoke all on function public.create_primary_contact_for_legacy_client()
  from public, anon, authenticated, service_role;

create trigger create_primary_contact_after_client_insert
  after insert on public.clients
  for each row execute function public.create_primary_contact_for_legacy_client();

create or replace function public.create_client_with_contacts(
  p_client jsonb,
  p_contacts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_contact jsonb;
  v_primary jsonb;
  v_conflict uuid;
  v_type text := btrim(coalesce(p_client ->> 'type', ''));
  v_status text := btrim(coalesce(p_client ->> 'status', ''));
  v_tier text := btrim(coalesce(p_client ->> 'account_tier', ''));
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if jsonb_typeof(p_contacts) <> 'array' or jsonb_array_length(p_contacts) = 0 then
    raise exception using errcode = '22023', message = 'at least one contact is required';
  end if;
  if coalesce(btrim(p_client ->> 'name'), '') = ''
     or v_type not in ('Company', 'Individual')
     or v_status not in ('Lead', 'Active', 'At Risk', 'Inactive')
     or v_tier not in ('Standard', 'Key Account') then
    raise exception using errcode = '22023', message = 'invalid client payload';
  end if;
  if (select count(*) from jsonb_array_elements(p_contacts) c
      where coalesce((c ->> 'is_primary')::boolean, false)) <> 1 then
    raise exception using errcode = '22023', message = 'exactly one primary contact is required';
  end if;
  if exists (
    select lower(btrim(c ->> 'email'))
    from jsonb_array_elements(p_contacts) c
    group by lower(btrim(c ->> 'email')) having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'contact emails must be unique';
  end if;

  for v_contact in select value from jsonb_array_elements(p_contacts)
  loop
    if coalesce(btrim(v_contact ->> 'full_name'), '') = ''
       or coalesce(btrim(v_contact ->> 'email'), '') = ''
       or (v_type = 'Company' and coalesce(btrim(v_contact ->> 'role_title'), '') = '') then
      raise exception using errcode = '22023', message = 'invalid contact payload';
    end if;
    select cc.client_id into v_conflict
    from public.client_contacts cc
    where cc.archived = false
      and lower(btrim(cc.email)) = lower(btrim(v_contact ->> 'email'))
    limit 1;
    if v_conflict is not null then
      return jsonb_build_object('status', 'conflict', 'client_id', v_conflict);
    end if;
  end loop;

  select value into v_primary from jsonb_array_elements(p_contacts) c
  where (c ->> 'is_primary')::boolean limit 1;

  insert into public.clients (
    name, type, contact, email, phone, status, notes, account_tier,
    industry, region, client_since, account_overview, preferred_services,
    relationship_notes, archived
  ) values (
    btrim(p_client ->> 'name'), v_type, btrim(v_primary ->> 'full_name'),
    lower(btrim(v_primary ->> 'email')), nullif(btrim(v_primary ->> 'phone'), ''),
    v_status, nullif(btrim(p_client ->> 'relationship_notes'), ''), v_tier,
    nullif(btrim(p_client ->> 'industry'), ''), nullif(btrim(p_client ->> 'region'), ''),
    (p_client ->> 'client_since')::date,
    nullif(btrim(p_client ->> 'account_overview'), ''),
    coalesce(array(select jsonb_array_elements_text(p_client -> 'preferred_services')), '{}'),
    nullif(btrim(p_client ->> 'relationship_notes'), ''), false
  ) returning id into v_client_id;

  delete from public.client_contacts where client_id = v_client_id;
  for v_contact in select value from jsonb_array_elements(p_contacts)
  loop
    insert into public.client_contacts (
      client_id, full_name, role_title, email, phone, is_primary
    ) values (
      v_client_id, btrim(v_contact ->> 'full_name'),
      nullif(btrim(v_contact ->> 'role_title'), ''),
      lower(btrim(v_contact ->> 'email')), nullif(btrim(v_contact ->> 'phone'), ''),
      (v_contact ->> 'is_primary')::boolean
    );
  end loop;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Client created: ' || btrim(p_client ->> 'name'), 'clients', v_client_id, 'created');
  return jsonb_build_object('status', 'ok', 'client_id', v_client_id);
end;
$$;

create or replace function public.update_client_with_contacts(
  p_client_id uuid,
  p_client jsonb,
  p_contacts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact jsonb;
  v_primary jsonb;
  v_conflict uuid;
  v_contact_id uuid;
  v_type text := btrim(coalesce(p_client ->> 'type', ''));
  v_status text := btrim(coalesce(p_client ->> 'status', ''));
  v_tier text := btrim(coalesce(p_client ->> 'account_tier', ''));
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  perform 1 from public.clients where id = p_client_id and archived = false for update;
  if not found then raise exception using errcode = 'P0002', message = 'client not found'; end if;
  if jsonb_typeof(p_contacts) <> 'array' or jsonb_array_length(p_contacts) = 0
     or coalesce(btrim(p_client ->> 'name'), '') = ''
     or v_type not in ('Company', 'Individual')
     or v_status not in ('Lead', 'Active', 'At Risk', 'Inactive')
     or v_tier not in ('Standard', 'Key Account') then
    raise exception using errcode = '22023', message = 'invalid client payload';
  end if;
  if (select count(*) from jsonb_array_elements(p_contacts) c
      where coalesce((c ->> 'is_primary')::boolean, false)) <> 1 then
    raise exception using errcode = '22023', message = 'exactly one primary contact is required';
  end if;
  if exists (
    select lower(btrim(c ->> 'email'))
    from jsonb_array_elements(p_contacts) c
    group by lower(btrim(c ->> 'email')) having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'contact emails must be unique';
  end if;

  for v_contact in select value from jsonb_array_elements(p_contacts)
  loop
    if coalesce(btrim(v_contact ->> 'full_name'), '') = ''
       or coalesce(btrim(v_contact ->> 'email'), '') = ''
       or (v_type = 'Company' and coalesce(btrim(v_contact ->> 'role_title'), '') = '') then
      raise exception using errcode = '22023', message = 'invalid contact payload';
    end if;
    if nullif(v_contact ->> 'id', '') is not null then
      v_contact_id := (v_contact ->> 'id')::uuid;
      if not exists (
        select 1 from public.client_contacts where id = v_contact_id and client_id = p_client_id
      ) then
        raise exception using errcode = '22023', message = 'contact does not belong to client';
      end if;
    end if;
    select cc.client_id into v_conflict
    from public.client_contacts cc
    where cc.archived = false and cc.client_id <> p_client_id
      and lower(btrim(cc.email)) = lower(btrim(v_contact ->> 'email'))
    limit 1;
    if v_conflict is not null then
      return jsonb_build_object('status', 'conflict', 'client_id', v_conflict);
    end if;
  end loop;

  select value into v_primary from jsonb_array_elements(p_contacts) c
  where (c ->> 'is_primary')::boolean limit 1;

  update public.clients set
    name = btrim(p_client ->> 'name'), type = v_type,
    contact = btrim(v_primary ->> 'full_name'),
    email = lower(btrim(v_primary ->> 'email')),
    phone = nullif(btrim(v_primary ->> 'phone'), ''), status = v_status,
    account_tier = v_tier, industry = nullif(btrim(p_client ->> 'industry'), ''),
    region = nullif(btrim(p_client ->> 'region'), ''),
    client_since = (p_client ->> 'client_since')::date,
    account_overview = nullif(btrim(p_client ->> 'account_overview'), ''),
    preferred_services = coalesce(
      array(select jsonb_array_elements_text(p_client -> 'preferred_services')), '{}'
    ),
    relationship_notes = nullif(btrim(p_client ->> 'relationship_notes'), ''),
    notes = nullif(btrim(p_client ->> 'relationship_notes'), '')
  where id = p_client_id;

  -- Release both partial unique indexes before reconciling the submitted set.
  -- The transaction restores the original rows automatically if any later
  -- statement fails.
  update public.client_contacts
  set archived = true, is_primary = false
  where client_id = p_client_id;

  for v_contact in select value from jsonb_array_elements(p_contacts)
  loop
    if nullif(v_contact ->> 'id', '') is null then
      insert into public.client_contacts (
        client_id, full_name, role_title, email, phone, is_primary
      ) values (
        p_client_id, btrim(v_contact ->> 'full_name'),
        nullif(btrim(v_contact ->> 'role_title'), ''),
        lower(btrim(v_contact ->> 'email')), nullif(btrim(v_contact ->> 'phone'), ''),
        (v_contact ->> 'is_primary')::boolean
      );
    else
      update public.client_contacts set
        full_name = btrim(v_contact ->> 'full_name'),
        role_title = nullif(btrim(v_contact ->> 'role_title'), ''),
        email = lower(btrim(v_contact ->> 'email')),
        phone = nullif(btrim(v_contact ->> 'phone'), ''),
        is_primary = (v_contact ->> 'is_primary')::boolean,
        archived = false
      where id = (v_contact ->> 'id')::uuid and client_id = p_client_id;
    end if;
  end loop;

  delete from public.client_contacts
  where client_id = p_client_id and archived = true;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Client updated: ' || btrim(p_client ->> 'name'), 'clients', p_client_id, 'updated');
  return jsonb_build_object('status', 'ok', 'client_id', p_client_id);
end;
$$;

create or replace function public.set_client_archived(p_client_id uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_conflict uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select name into v_name from public.clients where id = p_client_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'client not found'; end if;

  if p_archived = false then
    select active.client_id into v_conflict
    from public.client_contacts archived
    join public.client_contacts active
      on lower(btrim(active.email)) = lower(btrim(archived.email))
     and active.archived = false and active.client_id <> p_client_id
    where archived.client_id = p_client_id
    limit 1;
    if v_conflict is not null then
      return jsonb_build_object('status', 'conflict', 'client_id', v_conflict);
    end if;
  end if;

  update public.client_contacts set archived = p_archived where client_id = p_client_id;
  update public.clients set archived = p_archived where id = p_client_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values (
    case when p_archived then 'Client archived: ' else 'Client restored: ' end || v_name,
    'clients', p_client_id, case when p_archived then 'archived' else 'restored' end
  );
  return jsonb_build_object('status', 'ok', 'client_id', p_client_id);
end;
$$;

revoke all on function public.create_client_with_contacts(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_client_with_contacts(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.set_client_archived(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.create_client_with_contacts(jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.update_client_with_contacts(uuid, jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.set_client_archived(uuid, boolean)
  to authenticated, service_role;

-- The current submit_enquiry body is retained in full, with contact-first
-- matching and a safe empty search_path. Its public signature stays stable.
create or replace function public.submit_enquiry(
  full_name text, company text, email text, phone text, project_type text,
  location text, timeline text, description text, budget text,
  client_notes text, attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_client_id uuid;
  new_enquiry_id uuid;
  attachment jsonb;
  storage_metadata jsonb;
  already_claimed boolean;
begin
  if project_type not in ('Documentary', 'Event', 'Film', 'Visual Production', 'Other') then
    raise exception 'invalid project_type: %', project_type;
  end if;
  if coalesce(btrim(full_name), '') = '' or coalesce(btrim(email), '') = '' then
    raise exception 'full_name and email are required';
  end if;
  if length(full_name) > 200 or length(coalesce(company, '')) > 200
     or length(email) > 320 or length(coalesce(phone, '')) > 50
     or length(coalesce(location, '')) > 200 or length(coalesce(timeline, '')) > 200
     or length(coalesce(description, '')) > 5000 or length(coalesce(budget, '')) > 200
     or length(coalesce(client_notes, '')) > 2000 then
    raise exception 'one or more enquiry fields exceed their maximum length';
  end if;
  if jsonb_array_length(coalesce(attachments, '[]'::jsonb)) > 5 then
    raise exception 'too many attachments';
  end if;

  select cc.client_id into matched_client_id
  from public.client_contacts cc
  join public.clients c on c.id = cc.client_id
  where cc.archived = false and c.archived = false
    and lower(btrim(cc.email)) = lower(btrim(submit_enquiry.email))
  order by cc.is_primary desc, cc.created_at asc limit 1;

  if matched_client_id is null then
    select c.id into matched_client_id from public.clients c
    where c.archived = false and lower(btrim(c.email)) = lower(btrim(submit_enquiry.email))
    order by c.created_at asc limit 1;
  end if;

  if matched_client_id is null then
    insert into public.clients (name, type, contact, email, phone, status, notes)
    values (
      coalesce(nullif(btrim(company), ''), btrim(full_name)),
      case when coalesce(btrim(company), '') <> '' then 'Company' else 'Individual' end,
      btrim(full_name), lower(btrim(email)), phone, 'Lead', client_notes
    ) returning id into matched_client_id;
  end if;

  insert into public.enquiries (
    client_id, full_name, company, email, phone, project_type, location,
    timeline, description, budget, status, source, archived
  ) values (
    matched_client_id, full_name, nullif(btrim(company), ''), email, phone,
    project_type, location, timeline, description, nullif(btrim(budget), ''),
    'New', 'Website', false
  ) returning id into new_enquiry_id;

  for attachment in select * from jsonb_array_elements(coalesce(attachments, '[]'::jsonb))
  loop
    storage_metadata := (
      select o.metadata from storage.objects o
      where o.bucket_id = 'enquiry-attachments'
        and o.name = (attachment ->> 'storage_path') limit 1
    );
    if storage_metadata is null then continue; end if;
    already_claimed := exists (
      select 1 from public.enquiry_attachments ea
      where ea.storage_path = (attachment ->> 'storage_path')
    );
    if already_claimed then continue; end if;
    insert into public.enquiry_attachments (
      enquiry_id, storage_path, file_name, mime_type, size_bytes
    ) values (
      new_enquiry_id, attachment ->> 'storage_path', attachment ->> 'file_name',
      storage_metadata ->> 'mimetype', (storage_metadata ->> 'size')::integer
    );
  end loop;
  return new_enquiry_id;
end;
$$;

revoke all on function public.submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated, service_role;

commit;
