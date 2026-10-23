-- Unified Bookings & Partnerships workspace for OPS.
-- Preserves legacy tables while adding structured CRM fields and safe write APIs.

begin;

alter table public.bookings
  add column if not exists client_contact_id uuid references public.client_contacts (id) on delete set null,
  add column if not exists services text[] not null default '{}',
  add column if not exists project_details text,
  add column if not exists date_flexibility text,
  add column if not exists budget_range text,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists owner_name text,
  add column if not exists owner_email text,
  add column if not exists version integer not null default 1,
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.partnerships
  add column if not exists client_contact_id uuid references public.client_contacts (id) on delete set null,
  add column if not exists partnership_type text,
  add column if not exists focus_areas text[] not null default '{}',
  add column if not exists brand_goals text,
  add column if not exists industry text,
  add column if not exists brand_link text,
  add column if not exists brand_location text,
  add column if not exists content_frequency text,
  add column if not exists contact_role text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists budget_range text,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists owner_name text,
  add column if not exists owner_email text,
  add column if not exists version integer not null default 1,
  add column if not exists activated_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists declined_at timestamptz;

update public.bookings
set status = case
  when status in ('Enquiry', 'Applied') then 'New'
  when status in ('Booked', 'Approved') then 'Confirmed'
  else status
end;

update public.partnerships
set status = case
  when status in ('Applied', 'Enquiry') then 'New'
  when status = 'Approved' then 'Active'
  else status
end;

alter table public.bookings drop constraint if exists bookings_ops_status_check;
alter table public.bookings add constraint bookings_ops_status_check check (
  status in ('New', 'Reviewing', 'Quote Sent', 'Awaiting Deposit', 'Confirmed', 'Completed', 'Cancelled')
);
alter table public.partnerships drop constraint if exists partnerships_ops_status_check;
alter table public.partnerships add constraint partnerships_ops_status_check check (
  status in ('New', 'Reviewing', 'Qualified', 'Proposal Sent', 'Active', 'Closed', 'Declined')
);
alter table public.bookings drop constraint if exists bookings_version_check;
alter table public.bookings add constraint bookings_version_check check (version > 0);
alter table public.partnerships drop constraint if exists partnerships_version_check;
alter table public.partnerships add constraint partnerships_version_check check (version > 0);

create index if not exists bookings_ops_date_idx on public.bookings (date) where archived = false;
create index if not exists bookings_ops_status_idx on public.bookings (status) where archived = false;
create index if not exists partnerships_ops_status_idx on public.partnerships (status) where archived = false;

alter table public.bookings enable row level security;
alter table public.partnerships enable row level security;
revoke all on table public.bookings, public.partnerships
  from public, anon, authenticated, service_role;
grant select on public.bookings, public.partnerships to authenticated, service_role;
drop policy if exists ops_admin_bookings_select on public.bookings;
create policy ops_admin_bookings_select on public.bookings for select to authenticated
  using (public.is_admin((select auth.uid())));
drop policy if exists ops_admin_partnerships_select on public.partnerships;
create policy ops_admin_partnerships_select on public.partnerships for select to authenticated
  using (public.is_admin((select auth.uid())));

create or replace function public.submit_booking_request(p_request jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_contact_id uuid;
  v_booking_id uuid;
  v_email text := lower(btrim(coalesce(p_request ->> 'client_email', '')));
  v_name text := btrim(coalesce(p_request ->> 'client_name', ''));
  v_company text := btrim(coalesce(p_request ->> 'company', ''));
  v_services text[];
begin
  if v_name = '' or v_email = '' or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or coalesce(btrim(p_request ->> 'session_type'), '') = ''
    or char_length(v_name) > 120 or char_length(v_email) > 254
    or char_length(coalesce(p_request ->> 'client_phone', '')) > 40
    or char_length(v_company) > 160
    or char_length(coalesce(p_request ->> 'project_details', '')) > 500
    or char_length(coalesce(p_request ->> 'session_location', '')) > 200
    or char_length(coalesce(p_request ->> 'date_flexibility', '')) > 200
    or char_length(coalesce(p_request ->> 'budget', '')) > 200 then
    raise exception using errcode = '22023', message = 'invalid booking request';
  end if;
  if jsonb_typeof(coalesce(p_request -> 'services', '[]'::jsonb)) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid services';
  end if;
  v_services := coalesce(array(
    select btrim(value) from jsonb_array_elements_text(coalesce(p_request -> 'services', '[]'))
    where btrim(value) <> ''
  ), '{}');
  if cardinality(v_services) = 0 or cardinality(v_services) > 20 then
    raise exception using errcode = '22023', message = 'invalid services';
  end if;
  if char_length(btrim(p_request ->> 'session_type')) > 200
    or exists (select 1 from unnest(v_services) value where char_length(value) > 120) then
    raise exception using errcode = '22023', message = 'invalid booking request';
  end if;

  select cc.client_id, cc.id into v_client_id, v_contact_id
  from public.client_contacts cc join public.clients c on c.id = cc.client_id
  where cc.archived = false and c.archived = false and lower(btrim(cc.email)) = v_email
  order by cc.is_primary desc, cc.created_at asc limit 1;
  if v_client_id is null then
    select c.id into v_client_id from public.clients c
    where c.archived = false and lower(btrim(c.email)) = v_email
    order by c.created_at asc limit 1;
  end if;
  if v_client_id is null then
    insert into public.clients (name, type, contact, email, phone, status, notes)
    values (coalesce(nullif(v_company, ''), v_name), case when v_company = '' then 'Individual' else 'Company' end,
      v_name, v_email, nullif(btrim(p_request ->> 'client_phone'), ''), 'Lead', 'Website booking request')
    returning id into v_client_id;
  end if;
  if v_contact_id is null then
    select id into v_contact_id from public.client_contacts
    where client_id = v_client_id and archived = false and lower(btrim(email)) = v_email limit 1;
  end if;

  insert into public.bookings (
    client, client_contact_id, service, services, date, start, location, type, status, deposit,
    project_details, date_flexibility, budget_range, notes, archived
  ) values (
    v_client_id, v_contact_id, btrim(p_request ->> 'session_type'), v_services,
    nullif(p_request ->> 'preferred_date', '')::date,
    nullif(btrim(p_request ->> 'preferred_time'), ''),
    nullif(btrim(p_request ->> 'session_location'), ''), 'Website Request', 'New', 'Not Requested',
    nullif(btrim(p_request ->> 'project_details'), ''),
    nullif(btrim(p_request ->> 'date_flexibility'), ''),
    nullif(btrim(p_request ->> 'budget'), ''),
    'Submitted through the website booking form', false
  ) returning id into v_booking_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('New booking request from ' || v_name, 'bookings', v_booking_id, 'created');
  return v_booking_id;
end;
$$;

create or replace function public.submit_partnership_request(p_request jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_contact_id uuid;
  v_partnership_id uuid;
  v_email text := lower(btrim(coalesce(p_request ->> 'contact_email', '')));
  v_name text := btrim(coalesce(p_request ->> 'contact_name', ''));
  v_company text := btrim(coalesce(p_request ->> 'company', ''));
  v_focus text[];
begin
  if v_name = '' or v_email = '' or v_company = ''
    or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or coalesce(btrim(p_request ->> 'partnership_type'), '') = ''
    or char_length(v_name) > 120 or char_length(v_email) > 254 or char_length(v_company) > 160
    or char_length(coalesce(p_request ->> 'brand_goals', '')) > 500
    or char_length(coalesce(p_request ->> 'industry', '')) > 160
    or char_length(coalesce(p_request ->> 'brand_link', '')) > 300
    or char_length(coalesce(p_request ->> 'brand_location', '')) > 160
    or char_length(coalesce(p_request ->> 'content_frequency', '')) > 200
    or char_length(coalesce(p_request ->> 'partner_budget', '')) > 200 then
    raise exception using errcode = '22023', message = 'invalid partnership request';
  end if;
  if jsonb_typeof(coalesce(p_request -> 'focus_areas', '[]'::jsonb)) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid focus areas';
  end if;
  v_focus := coalesce(array(
    select btrim(value) from jsonb_array_elements_text(coalesce(p_request -> 'focus_areas', '[]'))
    where btrim(value) <> ''
  ), '{}');
  if cardinality(v_focus) = 0 or cardinality(v_focus) > 20 then
    raise exception using errcode = '22023', message = 'invalid focus areas';
  end if;
  if char_length(btrim(p_request ->> 'partnership_type')) > 200
    or char_length(coalesce(p_request ->> 'contact_role', '')) > 120
    or char_length(coalesce(p_request ->> 'contact_phone', '')) > 40
    or exists (select 1 from unnest(v_focus) value where char_length(value) > 120) then
    raise exception using errcode = '22023', message = 'invalid partnership request';
  end if;

  select cc.client_id, cc.id into v_client_id, v_contact_id
  from public.client_contacts cc join public.clients c on c.id = cc.client_id
  where cc.archived = false and c.archived = false and lower(btrim(cc.email)) = v_email
  order by cc.is_primary desc, cc.created_at asc limit 1;
  if v_client_id is null then
    select c.id into v_client_id from public.clients c
    where c.archived = false and lower(btrim(c.email)) = v_email
    order by c.created_at asc limit 1;
  end if;
  if v_client_id is null then
    insert into public.clients (name, type, contact, email, phone, status, notes)
    values (v_company, 'Company', v_name, v_email, nullif(btrim(p_request ->> 'contact_phone'), ''),
      'Lead', 'Website partnership request') returning id into v_client_id;
  end if;
  if v_contact_id is null then
    select id into v_contact_id from public.client_contacts
    where client_id = v_client_id and archived = false and lower(btrim(email)) = v_email limit 1;
  end if;

  insert into public.partnerships (
    client, client_contact_id, company, contact, contact_role, contact_email, contact_phone,
    partnership_type, focus_areas, brand_goals, industry, brand_link, brand_location,
    content_frequency, budget_range, application, status, archived
  ) values (
    v_client_id, v_contact_id, v_company, v_name, nullif(btrim(p_request ->> 'contact_role'), ''),
    v_email, nullif(btrim(p_request ->> 'contact_phone'), ''),
    btrim(p_request ->> 'partnership_type'), v_focus, nullif(btrim(p_request ->> 'brand_goals'), ''),
    nullif(btrim(p_request ->> 'industry'), ''), nullif(btrim(p_request ->> 'brand_link'), ''),
    nullif(btrim(p_request ->> 'brand_location'), ''),
    nullif(btrim(p_request ->> 'content_frequency'), ''), nullif(btrim(p_request ->> 'partner_budget'), ''),
    'Submitted through the website partnership form', 'New', false
  ) returning id into v_partnership_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('New partnership request from ' || v_company, 'partnerships', v_partnership_id, 'created');
  return v_partnership_id;
end;
$$;

create or replace function public.update_booking_request(
  p_booking_id uuid, p_request jsonb, p_expected_version integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.bookings%rowtype;
begin
  if not public.is_admin((select auth.uid())) then raise exception using errcode = '42501', message = 'admin access required'; end if;
  select * into v_row from public.bookings where id = p_booking_id and archived = false for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_row.version is distinct from p_expected_version then return jsonb_build_object('status', 'conflict', 'version', v_row.version); end if;
  if coalesce(btrim(p_request ->> 'service'), '') = '' or jsonb_typeof(coalesce(p_request -> 'services', '[]')) is distinct from 'array' then
    return jsonb_build_object('status', 'invalid', 'message', 'Check the booking details.');
  end if;
  update public.bookings set
    service = btrim(p_request ->> 'service'),
    services = array(select btrim(value) from jsonb_array_elements_text(coalesce(p_request -> 'services', '[]')) where btrim(value) <> ''),
    date = nullif(p_request ->> 'date', '')::date, start = nullif(btrim(p_request ->> 'start'), ''),
    location = nullif(btrim(p_request ->> 'location'), ''), project_details = nullif(btrim(p_request ->> 'project_details'), ''),
    date_flexibility = nullif(btrim(p_request ->> 'date_flexibility'), ''), budget_range = nullif(btrim(p_request ->> 'budget_range'), ''),
    owner_user_id = (select auth.uid()), owner_name = nullif(btrim(p_request ->> 'owner_name'), ''),
    owner_email = lower(nullif(btrim(p_request ->> 'owner_email'), '')), version = version + 1
  where id = p_booking_id;
  insert into public.ops_activity_log (message, collection, record_id, action) values ('Booking request updated', 'bookings', p_booking_id, 'updated');
  return jsonb_build_object('status', 'ok', 'record_id', p_booking_id, 'version', v_row.version + 1);
end; $$;

create or replace function public.set_booking_request_status(
  p_booking_id uuid, p_status text, p_expected_version integer, p_owner_name text, p_owner_email text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.bookings%rowtype;
begin
  if not public.is_admin((select auth.uid())) then raise exception using errcode = '42501', message = 'admin access required'; end if;
  if p_status not in ('New', 'Reviewing', 'Quote Sent', 'Awaiting Deposit', 'Confirmed', 'Completed', 'Cancelled') then return jsonb_build_object('status', 'invalid', 'message', 'Choose a valid status.'); end if;
  select * into v_row from public.bookings where id = p_booking_id and archived = false for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_row.version is distinct from p_expected_version then return jsonb_build_object('status', 'conflict', 'version', v_row.version); end if;
  update public.bookings set status = p_status, deposit = case when p_status = 'Awaiting Deposit' then 'Requested' when p_status = 'Confirmed' then 'Paid' else deposit end,
    confirmed_at = case when p_status = 'Confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    completed_at = case when p_status = 'Completed' then coalesce(completed_at, now()) else completed_at end,
    cancelled_at = case when p_status = 'Cancelled' then coalesce(cancelled_at, now()) else null end,
    owner_user_id = coalesce(owner_user_id, (select auth.uid())), owner_name = coalesce(owner_name, nullif(btrim(p_owner_name), '')),
    owner_email = coalesce(owner_email, lower(nullif(btrim(p_owner_email), ''))), version = version + 1 where id = p_booking_id;
  insert into public.ops_activity_log (message, collection, record_id, action) values ('Booking status changed to ' || p_status, 'bookings', p_booking_id, 'status_changed');
  return jsonb_build_object('status', 'ok', 'record_id', p_booking_id, 'version', v_row.version + 1);
end; $$;

create or replace function public.update_partnership_request(
  p_partnership_id uuid, p_request jsonb, p_expected_version integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.partnerships%rowtype;
begin
  if not public.is_admin((select auth.uid())) then raise exception using errcode = '42501', message = 'admin access required'; end if;
  select * into v_row from public.partnerships where id = p_partnership_id and archived = false for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_row.version is distinct from p_expected_version then return jsonb_build_object('status', 'conflict', 'version', v_row.version); end if;
  if coalesce(btrim(p_request ->> 'partnership_type'), '') = '' or jsonb_typeof(coalesce(p_request -> 'focus_areas', '[]')) is distinct from 'array' then
    return jsonb_build_object('status', 'invalid', 'message', 'Check the partnership details.');
  end if;
  update public.partnerships set partnership_type = btrim(p_request ->> 'partnership_type'),
    focus_areas = array(select btrim(value) from jsonb_array_elements_text(coalesce(p_request -> 'focus_areas', '[]')) where btrim(value) <> ''),
    brand_goals = nullif(btrim(p_request ->> 'brand_goals'), ''), industry = nullif(btrim(p_request ->> 'industry'), ''),
    brand_link = nullif(btrim(p_request ->> 'brand_link'), ''), brand_location = nullif(btrim(p_request ->> 'brand_location'), ''),
    content_frequency = nullif(btrim(p_request ->> 'content_frequency'), ''), budget_range = nullif(btrim(p_request ->> 'budget_range'), ''),
    owner_user_id = (select auth.uid()), owner_name = nullif(btrim(p_request ->> 'owner_name'), ''),
    owner_email = lower(nullif(btrim(p_request ->> 'owner_email'), '')), version = version + 1 where id = p_partnership_id;
  insert into public.ops_activity_log (message, collection, record_id, action) values ('Partnership request updated', 'partnerships', p_partnership_id, 'updated');
  return jsonb_build_object('status', 'ok', 'record_id', p_partnership_id, 'version', v_row.version + 1);
end; $$;

create or replace function public.set_partnership_request_status(
  p_partnership_id uuid, p_status text, p_expected_version integer, p_owner_name text, p_owner_email text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.partnerships%rowtype;
begin
  if not public.is_admin((select auth.uid())) then raise exception using errcode = '42501', message = 'admin access required'; end if;
  if p_status not in ('New', 'Reviewing', 'Qualified', 'Proposal Sent', 'Active', 'Closed', 'Declined') then return jsonb_build_object('status', 'invalid', 'message', 'Choose a valid status.'); end if;
  select * into v_row from public.partnerships where id = p_partnership_id and archived = false for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_row.version is distinct from p_expected_version then return jsonb_build_object('status', 'conflict', 'version', v_row.version); end if;
  update public.partnerships set status = p_status,
    activated_at = case when p_status = 'Active' then coalesce(activated_at, now()) else activated_at end,
    closed_at = case when p_status = 'Closed' then coalesce(closed_at, now()) else null end,
    declined_at = case when p_status = 'Declined' then coalesce(declined_at, now()) else null end,
    owner_user_id = coalesce(owner_user_id, (select auth.uid())), owner_name = coalesce(owner_name, nullif(btrim(p_owner_name), '')),
    owner_email = coalesce(owner_email, lower(nullif(btrim(p_owner_email), ''))), version = version + 1 where id = p_partnership_id;
  insert into public.ops_activity_log (message, collection, record_id, action) values ('Partnership status changed to ' || p_status, 'partnerships', p_partnership_id, 'status_changed');
  return jsonb_build_object('status', 'ok', 'record_id', p_partnership_id, 'version', v_row.version + 1);
end; $$;

revoke all on function public.submit_booking_request(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.submit_partnership_request(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.submit_booking_request(jsonb) to anon, authenticated;
grant execute on function public.submit_partnership_request(jsonb) to anon, authenticated;

revoke all on function public.update_booking_request(uuid, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.set_booking_request_status(uuid, text, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_partnership_request(uuid, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.set_partnership_request_status(uuid, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.update_booking_request(uuid, jsonb, integer) to authenticated;
grant execute on function public.set_booking_request_status(uuid, text, integer, text, text) to authenticated;
grant execute on function public.update_partnership_request(uuid, jsonb, integer) to authenticated;
grant execute on function public.set_partnership_request_status(uuid, text, integer, text, text) to authenticated;

commit;
