begin;

do $$
begin
  if exists (
    select 1 from public.projects
    where coalesce(btrim(name), '') = '' or client is null
  ) then
    raise exception 'projects migration preflight failed: every project needs a name and client';
  end if;

  if exists (
    select 1 from public.projects
    where status not in (
      'Planning', 'Pre-Production', 'Production', 'Review', 'Delivery',
      'Completed', 'On Hold', 'Cancelled'
    )
  ) then
    raise exception 'projects migration preflight failed: unsupported project status';
  end if;
end
$$;

alter table public.projects
  add column enquiry_id uuid references public.enquiries(id) on delete set null,
  add column client_contact_id uuid references public.client_contacts(id) on delete set null,
  add column project_type text not null default 'Other',
  add column services text[] not null default '{}',
  add column location text,
  add column start_date date,
  add column end_date date,
  add column people_resources text,
  add column budget_min numeric(12, 2),
  add column budget_max numeric(12, 2),
  add column currency text not null default 'ZAR',
  add column payment_status text not null default 'Not Invoiced',
  add column delivery_status text not null default 'Not Ready',
  add column stage_position integer not null default 0;

update public.projects
set project_type = case
  when type in ('Documentary', 'Event', 'Film', 'Visual Production', 'Other') then type
  else 'Other'
end;

update public.projects p
set client_contact_id = (
  select cc.id
  from public.client_contacts cc
  where cc.client_id = p.client and cc.archived = false
  order by cc.is_primary desc, cc.created_at asc, cc.id asc
  limit 1
)
where p.client_contact_id is null;

update public.projects p
set
  start_date = coalesce(p.start_date, b.date),
  end_date = coalesce(p.end_date, b.date),
  location = coalesce(nullif(btrim(p.location), ''), nullif(btrim(b.location), ''))
from public.bookings b
where b.id = p.booking;

with ordered as (
  select id, row_number() over (
    partition by status order by created_at asc, id asc
  ) - 1 as position
  from public.projects
)
update public.projects p
set stage_position = ordered.position
from ordered
where ordered.id = p.id;

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'Planning', 'Pre-Production', 'Production', 'Review', 'Delivery',
      'Completed', 'On Hold', 'Cancelled'
    )
  ),
  add constraint projects_project_type_check check (
    project_type in ('Documentary', 'Event', 'Film', 'Visual Production', 'Other')
  ),
  add constraint projects_payment_status_check check (
    payment_status in ('Not Invoiced', 'Deposit Pending', 'Partially Paid', 'Paid')
  ),
  add constraint projects_delivery_status_check check (
    delivery_status in ('Not Ready', 'Ready for Delivery', 'Delivered')
  ),
  add constraint projects_dates_check check (
    start_date is null or end_date is null or start_date <= end_date
  ),
  add constraint projects_budget_min_check check (budget_min is null or budget_min >= 0),
  add constraint projects_budget_max_check check (budget_max is null or budget_max >= 0),
  add constraint projects_budget_range_check check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  ),
  add constraint projects_currency_check check (currency ~ '^[A-Z]{3}$'),
  add constraint projects_stage_position_check check (stage_position >= 0);

create unique index projects_enquiry_id_idx
  on public.projects (enquiry_id) where enquiry_id is not null;
create index projects_client_contact_id_idx on public.projects (client_contact_id);
create index projects_active_stage_position_idx
  on public.projects (status, stage_position) where archived = false;
create index projects_start_date_idx on public.projects (start_date);

revoke all on public.projects from public, anon;
grant select, insert, update, delete on public.projects
  to authenticated, service_role;

create or replace function public.guard_project_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_contact_id is not null and not exists (
    select 1
    from public.client_contacts cc
    where cc.id = new.client_contact_id
      and cc.client_id = new.client
      and cc.archived = false
  ) then
    raise exception using errcode = '23514', message = 'project contact must belong to client';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_project_contact()
  from public, anon, authenticated, service_role;

create trigger guard_project_contact_before_write
  before insert or update of client, client_contact_id on public.projects
  for each row execute function public.guard_project_contact();

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  description text,
  due_date date,
  status text not null default 'Pending'
    check (status in ('Pending', 'Completed')),
  sort_order integer not null check (sort_order >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sort_order)
);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  due_date date,
  is_completed boolean not null default false,
  sort_order integer not null check (sort_order >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sort_order)
);

create table public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  due_date date,
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Ready', 'Delivered')),
  sort_order integer not null check (sort_order >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sort_order)
);

create index project_milestones_project_id_idx
  on public.project_milestones (project_id);
create index project_tasks_project_id_idx on public.project_tasks (project_id);
create index project_deliverables_project_id_idx
  on public.project_deliverables (project_id);

create trigger set_updated_at
  before update on public.project_milestones
  for each row execute function public.set_updated_at();
create trigger set_updated_at
  before update on public.project_tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at
  before update on public.project_deliverables
  for each row execute function public.set_updated_at();

alter table public.project_milestones enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_deliverables enable row level security;

create policy admin_full_access on public.project_milestones
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));
create policy admin_full_access on public.project_tasks
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));
create policy admin_full_access on public.project_deliverables
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

revoke all on public.project_milestones from public, anon;
revoke all on public.project_tasks from public, anon;
revoke all on public.project_deliverables from public, anon;
grant select, insert, update, delete on public.project_milestones
  to authenticated, service_role;
grant select, insert, update, delete on public.project_tasks
  to authenticated, service_role;
grant select, insert, update, delete on public.project_deliverables
  to authenticated, service_role;

insert into public.project_tasks (project_id, title, sort_order)
select p.id, btrim(lines.value), lines.ordinality - 1
from public.projects p
cross join lateral regexp_split_to_table(coalesce(p.tasks, ''), E'\\r?\\n')
  with ordinality as lines(value, ordinality)
where btrim(lines.value) <> ''
  and not exists (
    select 1 from public.project_tasks existing where existing.project_id = p.id
  );

insert into public.project_deliverables (project_id, title, sort_order)
select p.id, btrim(lines.value), lines.ordinality - 1
from public.projects p
cross join lateral regexp_split_to_table(coalesce(p.deliverables, ''), E'\\r?\\n')
  with ordinality as lines(value, ordinality)
where btrim(lines.value) <> ''
  and not exists (
    select 1 from public.project_deliverables existing
    where existing.project_id = p.id
  );

create or replace function public.replace_project_plan(
  p_project_id uuid,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_order integer;
  v_status text;
begin
  if jsonb_typeof(p_milestones) <> 'array'
     or jsonb_typeof(p_tasks) <> 'array'
     or jsonb_typeof(p_deliverables) <> 'array'
     or jsonb_array_length(p_milestones) > 100
     or jsonb_array_length(p_tasks) > 100
     or jsonb_array_length(p_deliverables) > 100 then
    raise exception using errcode = '22023', message = 'invalid project plan';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_milestones) item
    where coalesce(btrim(item ->> 'title'), '') = ''
      or coalesce(item ->> 'status', '') not in ('Pending', 'Completed')
  ) or exists (
    select 1 from jsonb_array_elements(p_tasks) item
    where coalesce(btrim(item ->> 'title'), '') = ''
  ) or exists (
    select 1 from jsonb_array_elements(p_deliverables) item
    where coalesce(btrim(item ->> 'title'), '') = ''
      or coalesce(item ->> 'status', '') not in (
        'Not Started', 'In Progress', 'Ready', 'Delivered'
      )
  ) then
    raise exception using errcode = '22023', message = 'invalid project plan item';
  end if;

  if exists (
    select item ->> 'id'
    from jsonb_array_elements(p_milestones) item
    where nullif(item ->> 'id', '') is not null
    group by item ->> 'id' having count(*) > 1
  ) or exists (
    select item ->> 'id'
    from jsonb_array_elements(p_tasks) item
    where nullif(item ->> 'id', '') is not null
    group by item ->> 'id' having count(*) > 1
  ) or exists (
    select item ->> 'id'
    from jsonb_array_elements(p_deliverables) item
    where nullif(item ->> 'id', '') is not null
    group by item ->> 'id' having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate project plan item';
  end if;

  update public.project_milestones set sort_order = sort_order + 1000
  where project_id = p_project_id;
  update public.project_tasks set sort_order = sort_order + 1000
  where project_id = p_project_id;
  update public.project_deliverables set sort_order = sort_order + 1000
  where project_id = p_project_id;

  v_order := 0;
  for v_item in select value from jsonb_array_elements(p_milestones)
  loop
    v_id := nullif(v_item ->> 'id', '')::uuid;
    v_status := v_item ->> 'status';
    if v_id is null then
      insert into public.project_milestones (
        project_id, title, description, due_date, status, sort_order, completed_at
      ) values (
        p_project_id,
        btrim(v_item ->> 'title'),
        nullif(btrim(v_item ->> 'description'), ''),
        nullif(v_item ->> 'due_date', '')::date,
        v_status,
        v_order,
        case when v_status = 'Completed' then now() end
      );
    else
      update public.project_milestones set
        title = btrim(v_item ->> 'title'),
        description = nullif(btrim(v_item ->> 'description'), ''),
        due_date = nullif(v_item ->> 'due_date', '')::date,
        status = v_status,
        sort_order = v_order,
        completed_at = case
          when v_status = 'Completed' then coalesce(completed_at, now())
          else null
        end
      where id = v_id and project_id = p_project_id;
      if not found then
        raise exception using errcode = '22023', message = 'milestone does not belong to project';
      end if;
    end if;
    v_order := v_order + 1;
  end loop;

  delete from public.project_milestones m
  where m.project_id = p_project_id
    and not exists (
      select 1 from jsonb_array_elements(p_milestones) item
      where nullif(item ->> 'id', '')::uuid = m.id
    );

  v_order := 0;
  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.project_tasks (
        project_id, title, due_date, is_completed, sort_order, completed_at
      ) values (
        p_project_id,
        btrim(v_item ->> 'title'),
        nullif(v_item ->> 'due_date', '')::date,
        coalesce((v_item ->> 'is_completed')::boolean, false),
        v_order,
        case when coalesce((v_item ->> 'is_completed')::boolean, false) then now() end
      );
    else
      update public.project_tasks set
        title = btrim(v_item ->> 'title'),
        due_date = nullif(v_item ->> 'due_date', '')::date,
        is_completed = coalesce((v_item ->> 'is_completed')::boolean, false),
        sort_order = v_order,
        completed_at = case
          when coalesce((v_item ->> 'is_completed')::boolean, false)
            then coalesce(completed_at, now())
          else null
        end
      where id = v_id and project_id = p_project_id;
      if not found then
        raise exception using errcode = '22023', message = 'task does not belong to project';
      end if;
    end if;
    v_order := v_order + 1;
  end loop;

  delete from public.project_tasks t
  where t.project_id = p_project_id
    and not exists (
      select 1 from jsonb_array_elements(p_tasks) item
      where nullif(item ->> 'id', '')::uuid = t.id
    );

  v_order := 0;
  for v_item in select value from jsonb_array_elements(p_deliverables)
  loop
    v_id := nullif(v_item ->> 'id', '')::uuid;
    v_status := v_item ->> 'status';
    if v_id is null then
      insert into public.project_deliverables (
        project_id, title, due_date, status, sort_order, completed_at
      ) values (
        p_project_id,
        btrim(v_item ->> 'title'),
        nullif(v_item ->> 'due_date', '')::date,
        v_status,
        v_order,
        case when v_status = 'Delivered' then now() end
      );
    else
      update public.project_deliverables set
        title = btrim(v_item ->> 'title'),
        due_date = nullif(v_item ->> 'due_date', '')::date,
        status = v_status,
        sort_order = v_order,
        completed_at = case
          when v_status = 'Delivered' then coalesce(completed_at, now())
          else null
        end
      where id = v_id and project_id = p_project_id;
      if not found then
        raise exception using errcode = '22023', message = 'deliverable does not belong to project';
      end if;
    end if;
    v_order := v_order + 1;
  end loop;

  delete from public.project_deliverables d
  where d.project_id = p_project_id
    and not exists (
      select 1 from jsonb_array_elements(p_deliverables) item
      where nullif(item ->> 'id', '')::uuid = d.id
    );

  update public.projects p set
    tasks = (
      select nullif(string_agg(t.title, E'\\n' order by t.sort_order), '')
      from public.project_tasks t where t.project_id = p_project_id
    ),
    deliverables = (
      select nullif(string_agg(d.title, E'\\n' order by d.sort_order), '')
      from public.project_deliverables d where d.project_id = p_project_id
    )
  where p.id = p_project_id;
end;
$$;

revoke all on function public.replace_project_plan(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.create_project_with_plan(
  p_project jsonb,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_client_id uuid;
  v_contact_id uuid;
  v_status text;
  v_project_type text;
  v_payment_status text;
  v_delivery_status text;
  v_start_date date;
  v_end_date date;
  v_budget_min numeric(12, 2);
  v_budget_max numeric(12, 2);
  v_position integer;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  begin
    v_client_id := (p_project ->> 'client_id')::uuid;
    v_contact_id := nullif(p_project ->> 'client_contact_id', '')::uuid;
    v_start_date := nullif(p_project ->> 'start_date', '')::date;
    v_end_date := nullif(p_project ->> 'end_date', '')::date;
    v_budget_min := nullif(p_project ->> 'budget_min', '')::numeric;
    v_budget_max := nullif(p_project ->> 'budget_max', '')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project values');
  end;

  v_status := coalesce(p_project ->> 'status', 'Planning');
  v_project_type := coalesce(p_project ->> 'project_type', 'Other');
  v_payment_status := coalesce(p_project ->> 'payment_status', 'Not Invoiced');
  v_delivery_status := coalesce(p_project ->> 'delivery_status', 'Not Ready');

  if coalesce(btrim(p_project ->> 'name'), '') = ''
     or v_status not in (
       'Planning', 'Pre-Production', 'Production', 'Review', 'Delivery',
       'Completed', 'On Hold', 'Cancelled'
     )
     or v_project_type not in (
       'Documentary', 'Event', 'Film', 'Visual Production', 'Other'
     )
     or v_payment_status not in (
       'Not Invoiced', 'Deposit Pending', 'Partially Paid', 'Paid'
     )
     or v_delivery_status not in ('Not Ready', 'Ready for Delivery', 'Delivered')
     or coalesce(p_project ->> 'currency', 'ZAR') !~ '^[A-Z]{3}$'
     or (v_start_date is not null and v_end_date is not null and v_start_date > v_end_date)
     or coalesce(v_budget_min, 0) < 0
     or coalesce(v_budget_max, 0) < 0
     or (v_budget_min is not null and v_budget_max is not null
       and v_budget_min > v_budget_max)
     or jsonb_typeof(coalesce(p_project -> 'services', '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project payload');
  end if;

  if not exists (
    select 1 from public.clients c where c.id = v_client_id and c.archived = false
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'client is unavailable');
  end if;

  if v_contact_id is null then
    select cc.id into v_contact_id
    from public.client_contacts cc
    where cc.client_id = v_client_id and cc.archived = false
    order by cc.is_primary desc, cc.created_at asc, cc.id asc
    limit 1;
  elsif not exists (
    select 1 from public.client_contacts cc
    where cc.id = v_contact_id and cc.client_id = v_client_id and cc.archived = false
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'contact is unavailable');
  end if;

  select coalesce(max(stage_position) + 1, 0) into v_position
  from public.projects where archived = false and status = v_status;

  insert into public.projects (
    name, client, client_contact_id, type, project_type, brief, services,
    location, start_date, end_date, timeline, people_resources,
    budget_min, budget_max, currency, payment_status, delivery_status,
    status, stage_position, archived
  ) values (
    btrim(p_project ->> 'name'),
    v_client_id,
    v_contact_id,
    v_project_type,
    v_project_type,
    nullif(btrim(p_project ->> 'overview'), ''),
    coalesce(array(select jsonb_array_elements_text(p_project -> 'services')), '{}'),
    nullif(btrim(p_project ->> 'location'), ''),
    v_start_date,
    v_end_date,
    nullif(btrim(p_project ->> 'schedule_notes'), ''),
    nullif(btrim(p_project ->> 'people_resources'), ''),
    v_budget_min,
    v_budget_max,
    coalesce(p_project ->> 'currency', 'ZAR'),
    v_payment_status,
    v_delivery_status,
    v_status,
    v_position,
    false
  ) returning id into v_project_id;

  perform public.replace_project_plan(
    v_project_id, p_milestones, p_tasks, p_deliverables
  );

  insert into public.ops_activity_log (message, collection, record_id, action)
  values (
    'Project created: ' || btrim(p_project ->> 'name'),
    'projects', v_project_id, 'created'
  );

  return jsonb_build_object('status', 'ok', 'project_id', v_project_id);
exception
  when check_violation or not_null_violation or foreign_key_violation
    or invalid_text_representation then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project payload');
end;
$$;

create or replace function public.convert_enquiry_to_project(
  p_enquiry_id uuid,
  p_project jsonb,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enquiry record;
  v_created jsonb;
  v_project_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  select id, client_id, status, archived into v_enquiry
  from public.enquiries where id = p_enquiry_id for update;
  if not found or v_enquiry.archived then
    return jsonb_build_object('status', 'not-found');
  end if;
  if v_enquiry.status in ('Completed', 'Closed') then
    return jsonb_build_object('status', 'invalid', 'message', 'enquiry cannot be converted');
  end if;

  select p.id into v_project_id
  from public.projects p where p.enquiry_id = p_enquiry_id limit 1;
  if v_project_id is not null then
    return jsonb_build_object('status', 'conflict', 'project_id', v_project_id);
  end if;
  if coalesce(p_project ->> 'client_id', '') <> v_enquiry.client_id::text then
    return jsonb_build_object('status', 'invalid', 'message', 'project client must match enquiry');
  end if;

  v_created := public.create_project_with_plan(
    p_project, p_milestones, p_tasks, p_deliverables
  );
  if v_created ->> 'status' <> 'ok' then return v_created; end if;
  v_project_id := (v_created ->> 'project_id')::uuid;

  update public.projects set enquiry_id = p_enquiry_id where id = v_project_id;
  update public.enquiries set status = 'Booked' where id = p_enquiry_id;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values
    ('Project created from enquiry', 'projects', v_project_id, 'converted'),
    ('Enquiry converted to project', 'enquiries', p_enquiry_id, 'converted');

  return jsonb_build_object('status', 'ok', 'project_id', v_project_id);
exception when unique_violation then
  select p.id into v_project_id
  from public.projects p where p.enquiry_id = p_enquiry_id limit 1;
  return jsonb_build_object('status', 'conflict', 'project_id', v_project_id);
end;
$$;

create or replace function public.move_project(
  p_project_id uuid,
  p_status text,
  p_stage_position integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project record;
  v_position integer;
  v_count integer;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if p_status not in (
    'Planning', 'Pre-Production', 'Production', 'Review', 'Delivery',
    'Completed', 'On Hold', 'Cancelled'
  ) or p_stage_position < 0 then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project movement');
  end if;

  perform 1 from public.projects
  where archived = false
  order by id for update;

  select id, name, status, stage_position, enquiry_id into v_project
  from public.projects where id = p_project_id and archived = false;
  if not found then return jsonb_build_object('status', 'not-found'); end if;

  update public.projects
  set stage_position = stage_position - 1
  where archived = false
    and status = v_project.status
    and id <> p_project_id
    and stage_position > v_project.stage_position;

  select count(*) into v_count from public.projects
  where archived = false and status = p_status and id <> p_project_id;
  v_position := least(p_stage_position, v_count);

  update public.projects
  set stage_position = stage_position + 1
  where archived = false
    and status = p_status
    and id <> p_project_id
    and stage_position >= v_position;

  update public.projects
  set status = p_status, stage_position = v_position
  where id = p_project_id;

  if v_project.enquiry_id is not null and p_status in ('Production', 'Completed') then
    update public.enquiries
    set status = case p_status
      when 'Production' then 'In Production'
      else 'Completed'
    end
    where id = v_project.enquiry_id
      and status is distinct from case p_status
        when 'Production' then 'In Production'
        else 'Completed'
      end;
    if found then
      insert into public.ops_activity_log (message, collection, record_id, action)
      values (
        'Enquiry status synchronized from project: ' || p_status,
        'enquiries', v_project.enquiry_id, 'status_updated'
      );
    end if;
  end if;

  if v_project.status is distinct from p_status
     or v_project.stage_position is distinct from v_position then
    insert into public.ops_activity_log (message, collection, record_id, action)
    values (
      'Project moved to ' || p_status,
      'projects', p_project_id, 'status_updated'
    );
  end if;

  return jsonb_build_object(
    'status', 'ok', 'project_id', p_project_id,
    'project_status', p_status, 'stage_position', v_position
  );
end;
$$;

create or replace function public.update_project_with_plan(
  p_project_id uuid,
  p_project jsonb,
  p_milestones jsonb,
  p_tasks jsonb,
  p_deliverables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing record;
  v_client_id uuid;
  v_contact_id uuid;
  v_status text;
  v_project_type text;
  v_payment_status text;
  v_delivery_status text;
  v_start_date date;
  v_end_date date;
  v_budget_min numeric(12, 2);
  v_budget_max numeric(12, 2);
  v_moved jsonb;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  select id, name, status, stage_position into v_existing
  from public.projects where id = p_project_id and archived = false for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;

  begin
    v_client_id := (p_project ->> 'client_id')::uuid;
    v_contact_id := nullif(p_project ->> 'client_contact_id', '')::uuid;
    v_start_date := nullif(p_project ->> 'start_date', '')::date;
    v_end_date := nullif(p_project ->> 'end_date', '')::date;
    v_budget_min := nullif(p_project ->> 'budget_min', '')::numeric;
    v_budget_max := nullif(p_project ->> 'budget_max', '')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project values');
  end;

  v_status := coalesce(p_project ->> 'status', v_existing.status);
  v_project_type := coalesce(p_project ->> 'project_type', 'Other');
  v_payment_status := coalesce(p_project ->> 'payment_status', 'Not Invoiced');
  v_delivery_status := coalesce(p_project ->> 'delivery_status', 'Not Ready');

  if coalesce(btrim(p_project ->> 'name'), '') = ''
     or v_status not in (
       'Planning', 'Pre-Production', 'Production', 'Review', 'Delivery',
       'Completed', 'On Hold', 'Cancelled'
     )
     or v_project_type not in (
       'Documentary', 'Event', 'Film', 'Visual Production', 'Other'
     )
     or v_payment_status not in (
       'Not Invoiced', 'Deposit Pending', 'Partially Paid', 'Paid'
     )
     or v_delivery_status not in ('Not Ready', 'Ready for Delivery', 'Delivered')
     or coalesce(p_project ->> 'currency', 'ZAR') !~ '^[A-Z]{3}$'
     or (v_start_date is not null and v_end_date is not null and v_start_date > v_end_date)
     or coalesce(v_budget_min, 0) < 0
     or coalesce(v_budget_max, 0) < 0
     or (v_budget_min is not null and v_budget_max is not null
       and v_budget_min > v_budget_max)
     or jsonb_typeof(coalesce(p_project -> 'services', '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project payload');
  end if;

  if not exists (
    select 1 from public.clients c where c.id = v_client_id and c.archived = false
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'client is unavailable');
  end if;
  if v_contact_id is not null and not exists (
    select 1 from public.client_contacts cc
    where cc.id = v_contact_id and cc.client_id = v_client_id and cc.archived = false
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'contact is unavailable');
  end if;

  update public.projects set
    name = btrim(p_project ->> 'name'),
    client = v_client_id,
    client_contact_id = v_contact_id,
    type = v_project_type,
    project_type = v_project_type,
    brief = nullif(btrim(p_project ->> 'overview'), ''),
    services = coalesce(array(select jsonb_array_elements_text(p_project -> 'services')), '{}'),
    location = nullif(btrim(p_project ->> 'location'), ''),
    start_date = v_start_date,
    end_date = v_end_date,
    timeline = nullif(btrim(p_project ->> 'schedule_notes'), ''),
    people_resources = nullif(btrim(p_project ->> 'people_resources'), ''),
    budget_min = v_budget_min,
    budget_max = v_budget_max,
    currency = coalesce(p_project ->> 'currency', 'ZAR'),
    payment_status = v_payment_status,
    delivery_status = v_delivery_status
  where id = p_project_id;

  perform public.replace_project_plan(
    p_project_id, p_milestones, p_tasks, p_deliverables
  );

  if v_status is distinct from v_existing.status then
    v_moved := public.move_project(p_project_id, v_status, v_existing.stage_position);
    if v_moved ->> 'status' <> 'ok' then return v_moved; end if;
  end if;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values (
    'Project updated: ' || btrim(p_project ->> 'name'),
    'projects', p_project_id, 'updated'
  );

  return jsonb_build_object('status', 'ok', 'project_id', p_project_id);
exception
  when check_violation or not_null_violation or foreign_key_violation
    or invalid_text_representation then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid project payload');
end;
$$;

create or replace function public.set_project_milestone_completed(
  p_milestone_id uuid,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select m.id, m.project_id, m.title, m.status into v_item
  from public.project_milestones m
  join public.projects p on p.id = m.project_id and p.archived = false
  where m.id = p_milestone_id for update of m;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if (v_item.status = 'Completed') is distinct from p_completed then
    update public.project_milestones set
      status = case when p_completed then 'Completed' else 'Pending' end,
      completed_at = case when p_completed then now() else null end
    where id = p_milestone_id;
    insert into public.ops_activity_log (message, collection, record_id, action)
    values (
      case when p_completed then 'Milestone completed: ' else 'Milestone reopened: ' end
        || v_item.title,
      'projects', v_item.project_id, 'milestone_updated'
    );
  end if;
  return jsonb_build_object('status', 'ok', 'project_id', v_item.project_id);
end;
$$;

create or replace function public.set_project_task_completed(
  p_task_id uuid,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select t.id, t.project_id, t.title, t.is_completed into v_item
  from public.project_tasks t
  join public.projects p on p.id = t.project_id and p.archived = false
  where t.id = p_task_id for update of t;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_item.is_completed is distinct from p_completed then
    update public.project_tasks set
      is_completed = p_completed,
      completed_at = case when p_completed then now() else null end
    where id = p_task_id;
    update public.projects set tasks = (
      select nullif(string_agg(t.title, E'\\n' order by t.sort_order), '')
      from public.project_tasks t where t.project_id = v_item.project_id
    ) where id = v_item.project_id;
    insert into public.ops_activity_log (message, collection, record_id, action)
    values (
      case when p_completed then 'Task completed: ' else 'Task reopened: ' end
        || v_item.title,
      'projects', v_item.project_id, 'task_updated'
    );
  end if;
  return jsonb_build_object('status', 'ok', 'project_id', v_item.project_id);
end;
$$;

create or replace function public.set_project_deliverable_status(
  p_deliverable_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if p_status not in ('Not Started', 'In Progress', 'Ready', 'Delivered') then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid deliverable status');
  end if;
  select d.id, d.project_id, d.title, d.status into v_item
  from public.project_deliverables d
  join public.projects p on p.id = d.project_id and p.archived = false
  where d.id = p_deliverable_id for update of d;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_item.status is distinct from p_status then
    update public.project_deliverables set
      status = p_status,
      completed_at = case when p_status = 'Delivered' then now() else null end
    where id = p_deliverable_id;
    update public.projects set deliverables = (
      select nullif(string_agg(d.title, E'\\n' order by d.sort_order), '')
      from public.project_deliverables d where d.project_id = v_item.project_id
    ) where id = v_item.project_id;
    insert into public.ops_activity_log (message, collection, record_id, action)
    values (
      'Deliverable moved to ' || p_status || ': ' || v_item.title,
      'projects', v_item.project_id, 'deliverable_updated'
    );
  end if;
  return jsonb_build_object('status', 'ok', 'project_id', v_item.project_id);
end;
$$;

create or replace function public.set_project_archived(
  p_project_id uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project record;
  v_position integer;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select id, name, status, stage_position, archived into v_project
  from public.projects where id = p_project_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_project.archived = p_archived then
    return jsonb_build_object('status', 'ok', 'project_id', p_project_id);
  end if;

  if p_archived then
    update public.projects set archived = true where id = p_project_id;
    update public.projects set stage_position = stage_position - 1
    where archived = false and status = v_project.status
      and stage_position > v_project.stage_position;
  else
    if not exists (
      select 1 from public.clients c
      where c.id = (select client from public.projects where id = p_project_id)
        and c.archived = false
    ) then
      return jsonb_build_object('status', 'invalid', 'message', 'client is unavailable');
    end if;
    select coalesce(max(stage_position) + 1, 0) into v_position
    from public.projects where archived = false and status = v_project.status;
    update public.projects p set
      archived = false,
      stage_position = v_position,
      client_contact_id = case
        when exists (
          select 1 from public.client_contacts cc
          where cc.id = p.client_contact_id
            and cc.client_id = p.client
            and cc.archived = false
        ) then p.client_contact_id
        else (
          select cc.id from public.client_contacts cc
          where cc.client_id = p.client and cc.archived = false
          order by cc.is_primary desc, cc.created_at asc, cc.id asc
          limit 1
        )
      end
    where id = p_project_id;
  end if;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values (
    case when p_archived then 'Project archived: ' else 'Project restored: ' end
      || v_project.name,
    'projects', p_project_id, case when p_archived then 'archived' else 'restored' end
  );
  return jsonb_build_object('status', 'ok', 'project_id', p_project_id);
end;
$$;

revoke all on function public.create_project_with_plan(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.convert_enquiry_to_project(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_project_with_plan(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.move_project(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.set_project_milestone_completed(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.set_project_task_completed(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.set_project_deliverable_status(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_project_archived(uuid, boolean)
  from public, anon, authenticated, service_role;

grant execute on function public.create_project_with_plan(jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.convert_enquiry_to_project(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.update_project_with_plan(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.move_project(uuid, text, integer)
  to authenticated;
grant execute on function public.set_project_milestone_completed(uuid, boolean)
  to authenticated;
grant execute on function public.set_project_task_completed(uuid, boolean)
  to authenticated;
grant execute on function public.set_project_deliverable_status(uuid, text)
  to authenticated;
grant execute on function public.set_project_archived(uuid, boolean)
  to authenticated;

commit;
