begin;

create or replace function public.update_enquiry_record(
  p_enquiry_id uuid,
  p_enquiry jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.enquiries%rowtype;
  v_full_name text;
  v_company text;
  v_email text;
  v_phone text;
  v_project_type text;
  v_location text;
  v_timeline text;
  v_description text;
  v_budget text;
  v_changed text[] := array[]::text[];
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  select * into v_existing
  from public.enquiries
  where id = p_enquiry_id and archived = false
  for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;

  if jsonb_typeof(p_enquiry) is distinct from 'object' then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid enquiry payload');
  end if;

  v_full_name := btrim(coalesce(p_enquiry ->> 'full_name', ''));
  v_company := nullif(btrim(coalesce(p_enquiry ->> 'company', '')), '');
  v_email := lower(btrim(coalesce(p_enquiry ->> 'email', '')));
  v_phone := btrim(coalesce(p_enquiry ->> 'phone', ''));
  v_project_type := btrim(coalesce(p_enquiry ->> 'project_type', ''));
  v_location := btrim(coalesce(p_enquiry ->> 'location', ''));
  v_timeline := btrim(coalesce(p_enquiry ->> 'timeline', ''));
  v_description := btrim(coalesce(p_enquiry ->> 'description', ''));
  v_budget := nullif(btrim(coalesce(p_enquiry ->> 'budget', '')), '');

  if v_full_name = '' or char_length(v_full_name) > 120
    or v_email = '' or char_length(v_email) > 254
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or v_phone = '' or char_length(v_phone) > 40
    or v_project_type not in ('Documentary', 'Event', 'Film', 'Visual Production', 'Other')
    or v_location = '' or char_length(v_location) > 200
    or v_timeline = '' or char_length(v_timeline) > 200
    or v_description = '' or char_length(v_description) > 2000
    or char_length(coalesce(v_company, '')) > 160
    or char_length(coalesce(v_budget, '')) > 200 then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid enquiry payload');
  end if;

  if v_existing.full_name is distinct from v_full_name then
    v_changed := array_append(v_changed, 'contact name');
  end if;
  if v_existing.company is distinct from v_company then
    v_changed := array_append(v_changed, 'company');
  end if;
  if lower(v_existing.email) is distinct from v_email then
    v_changed := array_append(v_changed, 'email');
  end if;
  if v_existing.phone is distinct from v_phone then
    v_changed := array_append(v_changed, 'phone');
  end if;
  if v_existing.project_type is distinct from v_project_type then
    v_changed := array_append(v_changed, 'project type');
  end if;
  if v_existing.location is distinct from v_location then
    v_changed := array_append(v_changed, 'location');
  end if;
  if v_existing.timeline is distinct from v_timeline then
    v_changed := array_append(v_changed, 'timeline');
  end if;
  if v_existing.description is distinct from v_description then
    v_changed := array_append(v_changed, 'project brief');
  end if;
  if v_existing.budget is distinct from v_budget then
    v_changed := array_append(v_changed, 'budget');
  end if;

  update public.enquiries
  set full_name = v_full_name,
      company = v_company,
      email = v_email,
      phone = v_phone,
      project_type = v_project_type,
      location = v_location,
      timeline = v_timeline,
      description = v_description,
      budget = v_budget
  where id = p_enquiry_id;

  if cardinality(v_changed) > 0 then
    insert into public.ops_activity_log (message, collection, record_id, action)
    values (
      'Enquiry updated: ' || array_to_string(v_changed, ', '),
      'enquiries', p_enquiry_id, 'updated'
    );
  end if;

  return jsonb_build_object('status', 'ok', 'enquiry_id', p_enquiry_id);
end;
$$;

create or replace function public.set_enquiry_status(
  p_enquiry_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enquiry record;
  v_project_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  if p_status not in ('New', 'Reviewing', 'Quoted', 'Follow-up', 'Closed') then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'Booked and production statuses are managed through Projects.'
    );
  end if;

  select id, status, archived into v_enquiry
  from public.enquiries
  where id = p_enquiry_id and archived = false
  for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;

  select id into v_project_id
  from public.projects
  where enquiry_id = p_enquiry_id
  limit 1;
  if v_project_id is not null then
    return jsonb_build_object('status', 'conflict', 'project_id', v_project_id);
  end if;

  if v_enquiry.status is distinct from p_status then
    update public.enquiries set status = p_status where id = p_enquiry_id;
    insert into public.ops_activity_log (message, collection, record_id, action)
    values (
      'Enquiry status changed from ' || v_enquiry.status || ' to ' || p_status,
      'enquiries', p_enquiry_id, 'status_updated'
    );
  end if;

  return jsonb_build_object('status', 'ok', 'enquiry_id', p_enquiry_id);
end;
$$;

revoke all on function public.update_enquiry_record(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.set_enquiry_status(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.update_enquiry_record(uuid, jsonb)
  to authenticated;
grant execute on function public.set_enquiry_status(uuid, text)
  to authenticated;

commit;
