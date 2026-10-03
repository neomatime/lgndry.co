-- Follow-ups workspace for the OPS Command Center.
-- All writes are atomic, admin-gated RPCs; authenticated users receive read access only.

begin;

create table public.follow_up_series (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  contact_id uuid references public.client_contacts (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  follow_up_type text not null,
  custom_type text,
  title text not null,
  overview text,
  notes text,
  priority text not null default 'Medium',
  contact_methods text[] not null,
  due_time time,
  checklist_template text[] not null default '{}',
  frequency text not null,
  interval_count integer not null default 1,
  weekdays smallint[] not null default '{}',
  month_anchor smallint,
  recurrence_rule text not null,
  ends_on date,
  max_occurrences integer,
  occurrences_created integer not null default 1,
  active boolean not null default true,
  owner_user_id uuid references auth.users (id) on delete set null,
  owner_name text not null,
  owner_email text not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_series_related_record_check
    check (num_nonnulls(enquiry_id, project_id) <= 1),
  constraint follow_up_series_type_check
    check (follow_up_type in (
      'Client Check-in', 'Quote Follow-up', 'Proposal Review', 'Deposit Reminder',
      'Approval', 'Delivery Confirmation', 'Other'
    )),
  constraint follow_up_series_custom_type_check
    check (
      (follow_up_type = 'Other' and coalesce(btrim(custom_type), '') <> '')
      or (follow_up_type <> 'Other' and custom_type is null)
    ),
  constraint follow_up_series_priority_check check (priority in ('Low', 'Medium', 'High')),
  constraint follow_up_series_contact_methods_check check (
    cardinality(contact_methods) > 0
    and contact_methods <@ array['Email', 'Phone', 'WhatsApp', 'Video Call', 'In Person']::text[]
  ),
  constraint follow_up_series_frequency_check
    check (frequency in ('Daily', 'Weekly', 'Monthly', 'Custom')),
  constraint follow_up_series_interval_check check (interval_count between 1 and 365),
  constraint follow_up_series_weekdays_check check (
    weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint follow_up_series_month_anchor_check
    check (month_anchor is null or month_anchor between 1 and 31),
  constraint follow_up_series_occurrences_check check (
    occurrences_created >= 1
    and (max_occurrences is null or max_occurrences >= occurrences_created)
  )
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity unique,
  client_id uuid not null references public.clients (id) on delete restrict,
  contact_id uuid references public.client_contacts (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  follow_up_type text not null,
  custom_type text,
  title text not null,
  overview text,
  notes text,
  due_date date not null,
  due_time time,
  priority text not null default 'Medium',
  contact_methods text[] not null,
  status text not null default 'Open',
  outcome text,
  cancellation_reason text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  owner_user_id uuid references auth.users (id) on delete set null,
  owner_name text not null,
  owner_email text not null,
  series_id uuid references public.follow_up_series (id) on delete set null,
  occurrence_number integer not null default 1,
  successor_id uuid references public.follow_ups (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_related_record_check check (num_nonnulls(enquiry_id, project_id) <= 1),
  constraint follow_ups_type_check check (follow_up_type in (
    'Client Check-in', 'Quote Follow-up', 'Proposal Review', 'Deposit Reminder',
    'Approval', 'Delivery Confirmation', 'Other'
  )),
  constraint follow_ups_custom_type_check check (
    (follow_up_type = 'Other' and coalesce(btrim(custom_type), '') <> '')
    or (follow_up_type <> 'Other' and custom_type is null)
  ),
  constraint follow_ups_priority_check check (priority in ('Low', 'Medium', 'High')),
  constraint follow_ups_contact_methods_check check (
    cardinality(contact_methods) > 0
    and contact_methods <@ array['Email', 'Phone', 'WhatsApp', 'Video Call', 'In Person']::text[]
  ),
  constraint follow_ups_status_check check (status in ('Open', 'Completed', 'Cancelled')),
  constraint follow_ups_terminal_fields_check check (
    (status = 'Open' and completed_at is null and cancelled_at is null)
    or (status = 'Completed' and completed_at is not null and cancelled_at is null)
    or (
      status = 'Cancelled' and cancelled_at is not null
      and coalesce(btrim(cancellation_reason), '') <> '' and completed_at is null
    )
  ),
  constraint follow_ups_occurrence_check check (occurrence_number >= 1),
  constraint follow_ups_version_check check (version >= 1),
  unique (series_id, occurrence_number)
);

create table public.follow_up_checklist_items (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.follow_ups (id) on delete cascade,
  label text not null check (coalesce(btrim(label), '') <> ''),
  sort_order integer not null check (sort_order >= 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_checklist_completion_check check (
    (is_completed and completed_at is not null) or (not is_completed and completed_at is null)
  ),
  -- Deferred so update_follow_up can rewrite every item's sort_order in one
  -- transaction (e.g. swapping two items) without a spurious duplicate-key
  -- violation on an intermediate write; Postgres checks the constraint once,
  -- at commit, instead of after each row-level UPDATE.
  unique (follow_up_id, sort_order) deferrable initially deferred
);

create trigger set_updated_at before update on public.follow_up_series
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.follow_ups
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.follow_up_checklist_items
  for each row execute function public.set_updated_at();

create index follow_ups_client_idx on public.follow_ups (client_id);
create index follow_ups_contact_idx on public.follow_ups (contact_id) where contact_id is not null;
create index follow_ups_enquiry_idx on public.follow_ups (enquiry_id) where enquiry_id is not null;
create index follow_ups_project_idx on public.follow_ups (project_id) where project_id is not null;
create index follow_ups_owner_idx on public.follow_ups (owner_user_id);
create index follow_ups_schedule_idx on public.follow_ups (status, due_date, due_time);
create index follow_ups_series_idx on public.follow_ups (series_id, occurrence_number)
  where series_id is not null;
create index follow_ups_successor_idx on public.follow_ups (successor_id);
-- No separate (follow_up_id, sort_order) index on follow_up_checklist_items:
-- the table's unique (follow_up_id, sort_order) constraint already creates a
-- btree index on exactly those columns, which also covers the follow_up_id FK.
create index follow_up_checklist_completed_by_idx
  on public.follow_up_checklist_items (completed_by);
create index follow_up_series_client_idx on public.follow_up_series (client_id);
create index follow_up_series_contact_idx on public.follow_up_series (contact_id);
create index follow_up_series_enquiry_idx on public.follow_up_series (enquiry_id);
create index follow_up_series_project_idx on public.follow_up_series (project_id);
create index follow_up_series_owner_idx on public.follow_up_series (owner_user_id);

alter table public.follow_up_series enable row level security;
alter table public.follow_ups enable row level security;
alter table public.follow_up_checklist_items enable row level security;

revoke all on table public.follow_up_series from public, anon, authenticated, service_role;
revoke all on table public.follow_ups from public, anon, authenticated, service_role;
revoke all on table public.follow_up_checklist_items from public, anon, authenticated, service_role;
grant select on table public.follow_up_series to authenticated;
grant select on table public.follow_ups to authenticated;
grant select on table public.follow_up_checklist_items to authenticated;
grant all on table public.follow_up_series to service_role;
grant all on table public.follow_ups to service_role;
grant all on table public.follow_up_checklist_items to service_role;
-- Supabase grants anon/authenticated default USAGE+SELECT+UPDATE on new
-- sequences; the identity column's backing sequence must never be readable
-- or advanceable by anything but service_role.
revoke all on sequence public.follow_ups_reference_number_seq
  from public, anon, authenticated;
grant usage, select on sequence public.follow_ups_reference_number_seq to service_role;

create policy admin_select_follow_up_series on public.follow_up_series
  for select to authenticated using (public.is_admin((select auth.uid())));
create policy admin_select_follow_ups on public.follow_ups
  for select to authenticated using (public.is_admin((select auth.uid())));
create policy admin_select_follow_up_checklist on public.follow_up_checklist_items
  for select to authenticated using (public.is_admin((select auth.uid())));

create or replace function public.follow_up_relationships_valid(
  p_client_id uuid,
  p_contact_id uuid,
  p_enquiry_id uuid,
  p_project_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    p_client_id is not null
    and num_nonnulls(p_enquiry_id, p_project_id) <= 1
    and exists (
      select 1 from public.clients c where c.id = p_client_id and c.archived = false
    )
    and (
      p_contact_id is null or exists (
        select 1 from public.client_contacts cc
        where cc.id = p_contact_id and cc.client_id = p_client_id and cc.archived = false
      )
    )
    and (
      p_enquiry_id is null or exists (
        select 1 from public.enquiries e
        where e.id = p_enquiry_id and e.client_id = p_client_id and e.archived = false
      )
    )
    and (
      p_project_id is null or exists (
        select 1 from public.projects p
        where p.id = p_project_id and p.client = p_client_id and p.archived = false
      )
    );
$$;

revoke all on function public.follow_up_relationships_valid(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- Edit-time variant of follow_up_relationships_valid: an archived client,
-- contact, enquiry, or project may only be blocked when it is being newly
-- selected or changed. A relation id carried forward unchanged from the
-- existing row is exempt from the archived check (but still must satisfy
-- the "belongs to this client" shape), so an existing follow-up whose linked
-- record was later archived stays editable.
create or replace function public.follow_up_relationships_valid_for_edit(
  p_client_id uuid,
  p_contact_id uuid,
  p_enquiry_id uuid,
  p_project_id uuid,
  p_existing_client_id uuid,
  p_existing_contact_id uuid,
  p_existing_enquiry_id uuid,
  p_existing_project_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    p_client_id is not null
    and num_nonnulls(p_enquiry_id, p_project_id) <= 1
    and exists (
      select 1 from public.clients c where c.id = p_client_id
        and (c.archived = false or p_client_id = p_existing_client_id)
    )
    and (
      p_contact_id is null or exists (
        select 1 from public.client_contacts cc
        where cc.id = p_contact_id and cc.client_id = p_client_id
          and (cc.archived = false or p_contact_id = p_existing_contact_id)
      )
    )
    and (
      p_enquiry_id is null or exists (
        select 1 from public.enquiries e
        where e.id = p_enquiry_id and e.client_id = p_client_id
          and (e.archived = false or p_enquiry_id = p_existing_enquiry_id)
      )
    )
    and (
      p_project_id is null or exists (
        select 1 from public.projects p
        where p.id = p_project_id and p.client = p_client_id
          and (p.archived = false or p_project_id = p_existing_project_id)
      )
    );
$$;

revoke all on function public.follow_up_relationships_valid_for_edit(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

create or replace function public.create_follow_up(
  p_follow_up jsonb,
  p_checklist jsonb,
  p_recurrence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id uuid := nullif(p_follow_up ->> 'client_id', '')::uuid;
  v_contact_id uuid := nullif(p_follow_up ->> 'contact_id', '')::uuid;
  v_enquiry_id uuid := nullif(p_follow_up ->> 'enquiry_id', '')::uuid;
  v_project_id uuid := nullif(p_follow_up ->> 'project_id', '')::uuid;
  v_type text := btrim(coalesce(p_follow_up ->> 'follow_up_type', ''));
  v_custom_type text := nullif(btrim(coalesce(p_follow_up ->> 'custom_type', '')), '');
  v_title text := btrim(coalesce(p_follow_up ->> 'title', ''));
  v_priority text := btrim(coalesce(p_follow_up ->> 'priority', ''));
  v_methods text[] := array(
    select jsonb_array_elements_text(coalesce(p_follow_up -> 'contact_methods', '[]'::jsonb))
  );
  v_follow_up_id uuid;
  v_series_id uuid;
  v_recurring boolean := coalesce((p_recurrence ->> 'enabled')::boolean, false);
begin
  if not public.is_admin(v_user_id) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if not public.follow_up_relationships_valid(
    v_client_id, v_contact_id, v_enquiry_id, v_project_id
  ) then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'The selected contact, enquiry, or project doesn''t belong to this client.'
    );
  end if;

  if jsonb_typeof(p_follow_up) <> 'object'
    or jsonb_typeof(coalesce(p_checklist, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_checklist, '[]'::jsonb)) > 50
    or v_type not in (
      'Client Check-in', 'Quote Follow-up', 'Proposal Review', 'Deposit Reminder',
      'Approval', 'Delivery Confirmation', 'Other'
    )
    or (v_type = 'Other' and v_custom_type is null)
    or (v_type <> 'Other' and v_custom_type is not null)
    or v_title = '' or char_length(v_title) > 240
    or v_priority not in ('Low', 'Medium', 'High')
    or cardinality(v_methods) = 0
    or not (v_methods <@ array['Email', 'Phone', 'WhatsApp', 'Video Call', 'In Person']::text[])
    or coalesce(btrim(p_follow_up ->> 'owner_name'), '') = ''
    or coalesce(btrim(p_follow_up ->> 'owner_email'), '') = '' then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid follow-up payload');
  end if;

  if v_recurring then
    if coalesce(btrim(p_recurrence ->> 'frequency'), '') not in (
      'Daily', 'Weekly', 'Monthly', 'Custom'
    ) or coalesce((p_recurrence ->> 'interval_count')::integer, 0) not between 1 and 365
      or coalesce(btrim(p_recurrence ->> 'recurrence_rule'), '') = '' then
      return jsonb_build_object('status', 'invalid', 'message', 'invalid recurrence payload');
    end if;
    insert into public.follow_up_series (
      client_id, contact_id, enquiry_id, project_id, follow_up_type, custom_type,
      title, overview, notes, priority, contact_methods, due_time, checklist_template,
      frequency, interval_count, weekdays, month_anchor, recurrence_rule, ends_on,
      max_occurrences, owner_user_id, owner_name, owner_email
    ) values (
      v_client_id, v_contact_id, v_enquiry_id, v_project_id, v_type, v_custom_type,
      v_title, nullif(btrim(p_follow_up ->> 'overview'), ''),
      nullif(btrim(p_follow_up ->> 'notes'), ''), v_priority, v_methods,
      nullif(p_follow_up ->> 'due_time', '')::time,
      array(select btrim(value ->> 'label') from jsonb_array_elements(p_checklist)),
      p_recurrence ->> 'frequency', (p_recurrence ->> 'interval_count')::integer,
      coalesce(array(
        select value::smallint
        from jsonb_array_elements_text(coalesce(p_recurrence -> 'weekdays', '[]'::jsonb))
      ), '{}'),
      nullif(p_recurrence ->> 'month_anchor', '')::smallint,
      p_recurrence ->> 'recurrence_rule', nullif(p_recurrence ->> 'ends_on', '')::date,
      nullif(p_recurrence ->> 'max_occurrences', '')::integer,
      v_user_id, btrim(p_follow_up ->> 'owner_name'), lower(btrim(p_follow_up ->> 'owner_email'))
    ) returning id into v_series_id;
  end if;

  insert into public.follow_ups (
    client_id, contact_id, enquiry_id, project_id, follow_up_type, custom_type,
    title, overview, notes, due_date, due_time, priority, contact_methods,
    owner_user_id, owner_name, owner_email, series_id
  ) values (
    v_client_id, v_contact_id, v_enquiry_id, v_project_id, v_type, v_custom_type,
    v_title, nullif(btrim(p_follow_up ->> 'overview'), ''),
    nullif(btrim(p_follow_up ->> 'notes'), ''), (p_follow_up ->> 'due_date')::date,
    nullif(p_follow_up ->> 'due_time', '')::time, v_priority, v_methods,
    v_user_id, btrim(p_follow_up ->> 'owner_name'), lower(btrim(p_follow_up ->> 'owner_email')),
    v_series_id
  ) returning id into v_follow_up_id;

  insert into public.follow_up_checklist_items (follow_up_id, label, sort_order)
  select v_follow_up_id, btrim(item.value ->> 'label'), item.ordinality - 1
  from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) with ordinality item
  where coalesce(btrim(item.value ->> 'label'), '') <> '';

  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Follow-up created: ' || v_title, 'follow_ups', v_follow_up_id, 'created');
  return jsonb_build_object('status', 'ok', 'follow_up_id', v_follow_up_id);
end;
$$;

create or replace function public.update_follow_up(
  p_follow_up_id uuid,
  p_follow_up jsonb,
  p_checklist jsonb,
  p_recurrence jsonb,
  p_scope text,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.follow_ups%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_client_id uuid := nullif(p_follow_up ->> 'client_id', '')::uuid;
  v_contact_id uuid := nullif(p_follow_up ->> 'contact_id', '')::uuid;
  v_enquiry_id uuid := nullif(p_follow_up ->> 'enquiry_id', '')::uuid;
  v_project_id uuid := nullif(p_follow_up ->> 'project_id', '')::uuid;
  v_type text := btrim(coalesce(p_follow_up ->> 'follow_up_type', ''));
  v_custom_type text := nullif(btrim(coalesce(p_follow_up ->> 'custom_type', '')), '');
  v_title text := btrim(coalesce(p_follow_up ->> 'title', ''));
  v_methods text[] := array(
    select jsonb_array_elements_text(coalesce(p_follow_up -> 'contact_methods', '[]'::jsonb))
  );
  v_recurring boolean := coalesce((p_recurrence ->> 'enabled')::boolean, false);
  v_series public.follow_up_series%rowtype;
  v_series_after public.follow_up_series%rowtype;
  -- ops_activity_log messages stay within 200 characters: the longest prefix
  -- below ('Series restarted with updated defaults: ', 40) + 150 title = 190.
  v_message text := 'Follow-up updated: ' || left(v_title, 150);
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_existing from public.follow_ups
  where id = p_follow_up_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_existing.version is distinct from p_version then
    return jsonb_build_object('status', 'conflict', 'message', 'Follow-up changed elsewhere.');
  end if;
  if v_existing.status <> 'Open' then
    return jsonb_build_object('status', 'invalid', 'message', 'Only open follow-ups can be edited.');
  end if;
  if not public.follow_up_relationships_valid_for_edit(
    v_client_id, v_contact_id, v_enquiry_id, v_project_id,
    v_existing.client_id, v_existing.contact_id, v_existing.enquiry_id, v_existing.project_id
  ) then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'The selected contact, enquiry, or project doesn''t belong to this client.'
    );
  end if;

  if p_scope not in ('occurrence', 'future')
    or jsonb_typeof(coalesce(p_checklist, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_checklist, '[]'::jsonb)) > 50
    or v_type not in (
      'Client Check-in', 'Quote Follow-up', 'Proposal Review', 'Deposit Reminder',
      'Approval', 'Delivery Confirmation', 'Other'
    )
    or (v_type = 'Other' and v_custom_type is null)
    or (v_type <> 'Other' and v_custom_type is not null)
    or v_title = '' or cardinality(v_methods) = 0
    -- Same title/priority rules as create_follow_up, checked here so a bad
    -- payload is an 'invalid' result rather than a raw CHECK / NOT NULL
    -- error from the writes below. Priority is checked as sent (not trimmed)
    -- because the writes below store it as sent.
    or char_length(v_title) > 240
    or coalesce(p_follow_up ->> 'priority', '') not in ('Low', 'Medium', 'High')
    or coalesce(btrim(p_follow_up ->> 'due_date'), '') = '' then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid follow-up payload');
  end if;

  -- Every checklist item id referenced by the payload must already belong to
  -- this follow-up. Validated up front, before any write, so a stray/invalid
  -- id can never leave the follow-up row or checklist half-updated.
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) as elem
    where nullif(elem ->> 'id', '') is not null
      and not exists (
        select 1 from public.follow_up_checklist_items ci
        where ci.id = (elem ->> 'id')::uuid and ci.follow_up_id = p_follow_up_id
      )
  ) then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid checklist item');
  end if;

  -- Future scope only (occurrence-scope edits never touch the series): the
  -- series row is locked after the follow-up row, the same order
  -- complete_follow_up / cancel_follow_up / reschedule_follow_up use. Read
  -- before any write so the occurrence-limit check below sees the count the
  -- series update will be checked against, and so the activity message can
  -- tell what the edit did to the series.
  if p_scope = 'future' and v_existing.series_id is not null then
    select * into v_series from public.follow_up_series
    where id = v_existing.series_id for update;
  end if;
  -- A future-scope edit that lowers max_occurrences below the occurrences
  -- the series has already created would otherwise fail on the
  -- follow_up_series_occurrences_check constraint (raw 23514); a new series
  -- starts at occurrences_created = 1.
  if p_scope = 'future' and v_recurring
    and nullif(p_recurrence ->> 'max_occurrences', '')::integer
      < coalesce(v_series.occurrences_created, 1) then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'This series has already created ' || coalesce(v_series.occurrences_created, 1)
        || ' occurrences, so it can''t end after fewer than that.'
    );
  end if;

  update public.follow_ups set
    client_id = v_client_id, contact_id = v_contact_id, enquiry_id = v_enquiry_id,
    project_id = v_project_id, follow_up_type = v_type, custom_type = v_custom_type,
    title = v_title, overview = nullif(btrim(p_follow_up ->> 'overview'), ''),
    notes = nullif(btrim(p_follow_up ->> 'notes'), ''),
    due_date = (p_follow_up ->> 'due_date')::date,
    due_time = nullif(p_follow_up ->> 'due_time', '')::time,
    priority = p_follow_up ->> 'priority', contact_methods = v_methods,
    version = version + 1
  where id = p_follow_up_id;

  -- Items left out of the payload are hard-deleted; one activity row per
  -- removed item keeps its label and completion state in the history.
  -- Capped: 24 prefix + 150 label + 16 suffix = 190 characters at most.
  with removed as (
    delete from public.follow_up_checklist_items
    where follow_up_id = p_follow_up_id
      and id not in (
        select (value ->> 'id')::uuid from jsonb_array_elements(p_checklist)
        where nullif(value ->> 'id', '') is not null
      )
    returning label, is_completed
  )
  insert into public.ops_activity_log (message, collection, record_id, action)
  select
    'Checklist item removed: ' || left(coalesce(removed.label, ''), 150)
      || case when removed.is_completed then ' (was completed)' else ' (not completed)' end,
    'follow_ups', p_follow_up_id, 'checklist_updated'
  from removed;
  for v_item in select value from jsonb_array_elements(p_checklist)
  loop
    if coalesce(btrim(v_item ->> 'label'), '') = '' then continue; end if;
    v_item_id := nullif(v_item ->> 'id', '')::uuid;
    if v_item_id is null then
      insert into public.follow_up_checklist_items (follow_up_id, label, sort_order)
      values (p_follow_up_id, btrim(v_item ->> 'label'), (v_item ->> 'sort_order')::integer);
    else
      update public.follow_up_checklist_items set
        label = btrim(v_item ->> 'label'), sort_order = (v_item ->> 'sort_order')::integer,
        version = version + 1
      where id = v_item_id and follow_up_id = p_follow_up_id;
      if not found then
        -- Unreachable given the upfront existence check above; raised (not
        -- returned) as defense-in-depth so a write already committed in
        -- this transaction is rolled back rather than partially applied.
        raise exception using errcode = 'P0001', message = 'invalid checklist item';
      end if;
    end if;
  end loop;

  if p_scope = 'future' then
    if v_existing.series_id is null and v_recurring then
      insert into public.follow_up_series (
        client_id, contact_id, enquiry_id, project_id, follow_up_type, custom_type,
        title, overview, notes, priority, contact_methods, due_time, checklist_template,
        frequency, interval_count, weekdays, month_anchor, recurrence_rule, ends_on,
        max_occurrences, owner_user_id, owner_name, owner_email
      ) values (
        v_client_id, v_contact_id, v_enquiry_id, v_project_id, v_type, v_custom_type,
        v_title, nullif(btrim(p_follow_up ->> 'overview'), ''),
        nullif(btrim(p_follow_up ->> 'notes'), ''), p_follow_up ->> 'priority', v_methods,
        nullif(p_follow_up ->> 'due_time', '')::time,
        array(select btrim(value ->> 'label') from jsonb_array_elements(p_checklist)),
        p_recurrence ->> 'frequency', (p_recurrence ->> 'interval_count')::integer,
        coalesce(array(select value::smallint from jsonb_array_elements_text(
          coalesce(p_recurrence -> 'weekdays', '[]'::jsonb)
        )), '{}'), nullif(p_recurrence ->> 'month_anchor', '')::smallint,
        p_recurrence ->> 'recurrence_rule', nullif(p_recurrence ->> 'ends_on', '')::date,
        nullif(p_recurrence ->> 'max_occurrences', '')::integer,
        v_existing.owner_user_id, v_existing.owner_name, v_existing.owner_email
      ) returning id into v_existing.series_id;
      update public.follow_ups set series_id = v_existing.series_id where id = p_follow_up_id;
      v_message := 'Follow-up set to repeat: ' || left(v_title, 150);
    elsif v_existing.series_id is not null and not v_recurring then
      update public.follow_up_series set active = false, version = version + 1
      where id = v_existing.series_id;
      if v_series.active then
        v_message := 'Series set to stop repeating: ' || left(v_title, 150);
      end if;
    elsif v_existing.series_id is not null and v_recurring then
      update public.follow_up_series set
        client_id = v_client_id, contact_id = v_contact_id, enquiry_id = v_enquiry_id,
        project_id = v_project_id, follow_up_type = v_type, custom_type = v_custom_type,
        title = v_title, overview = nullif(btrim(p_follow_up ->> 'overview'), ''),
        notes = nullif(btrim(p_follow_up ->> 'notes'), ''),
        priority = p_follow_up ->> 'priority', contact_methods = v_methods,
        due_time = nullif(p_follow_up ->> 'due_time', '')::time,
        checklist_template = array(
          select btrim(value ->> 'label') from jsonb_array_elements(p_checklist)
        ), frequency = p_recurrence ->> 'frequency',
        interval_count = (p_recurrence ->> 'interval_count')::integer,
        weekdays = coalesce(array(select value::smallint from jsonb_array_elements_text(
          coalesce(p_recurrence -> 'weekdays', '[]'::jsonb)
        )), '{}'), month_anchor = nullif(p_recurrence ->> 'month_anchor', '')::smallint,
        recurrence_rule = p_recurrence ->> 'recurrence_rule',
        ends_on = nullif(p_recurrence ->> 'ends_on', '')::date,
        max_occurrences = nullif(p_recurrence ->> 'max_occurrences', '')::integer,
        active = true, version = version + 1
      where id = v_existing.series_id;
      select * into v_series_after from public.follow_up_series where id = v_existing.series_id;
      if not v_series.active then
        v_message := 'Series restarted with updated defaults: ' || left(v_title, 150);
      elsif (v_series.frequency, v_series.interval_count, v_series.weekdays,
          v_series.month_anchor, v_series.ends_on, v_series.max_occurrences)
        is distinct from (v_series_after.frequency, v_series_after.interval_count,
          v_series_after.weekdays, v_series_after.month_anchor, v_series_after.ends_on,
          v_series_after.max_occurrences) then
        v_message := 'Series recurrence changed: ' || left(v_title, 150);
      else
        v_message := 'Series defaults updated: ' || left(v_title, 150);
      end if;
    end if;
  end if;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values (v_message, 'follow_ups', p_follow_up_id, 'updated');
  return jsonb_build_object('status', 'ok', 'follow_up_id', p_follow_up_id);
end;
$$;

create or replace function public.set_follow_up_checklist_item(
  p_item_id uuid,
  p_completed boolean,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.follow_up_checklist_items%rowtype;
  v_follow_up public.follow_ups%rowtype;
  v_follow_up_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  -- Locks the parent follow-up row before the checklist item, the same
  -- order update_follow_up uses, so the two functions can never deadlock
  -- by taking these two locks in opposite orders.
  select follow_up_id into v_follow_up_id from public.follow_up_checklist_items
  where id = p_item_id;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  select * into v_follow_up from public.follow_ups where id = v_follow_up_id for update;
  if v_follow_up.status <> 'Open' then
    return jsonb_build_object('status', 'invalid', 'message', 'Follow-up is no longer open.');
  end if;
  select * into v_item from public.follow_up_checklist_items where id = p_item_id for update;
  -- The item existed on the unlocked read above, but another transaction
  -- could have deleted it while this call waited on the follow-up lock.
  -- Without this check v_item would be all-NULL, the version comparison
  -- below would silently evaluate to NULL (never TRUE), and both writes
  -- below would target a NULL id and affect zero rows while still
  -- returning 'ok' - caught here instead of relying on an incidental
  -- NOT NULL constraint elsewhere.
  if not found then
    return jsonb_build_object('status', 'not-found');
  end if;
  if v_item.version is distinct from p_version then
    return jsonb_build_object('status', 'conflict', 'message', 'Checklist changed elsewhere.');
  end if;
  update public.follow_up_checklist_items set
    is_completed = p_completed,
    completed_at = case when p_completed then now() else null end,
    completed_by = case when p_completed then (select auth.uid()) else null end,
    version = version + 1
  where id = p_item_id;
  update public.follow_ups set version = version + 1 where id = v_follow_up_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values (
    case when p_completed then 'Checklist item completed: ' else 'Checklist item reopened: ' end
      || v_item.label,
    'follow_ups', v_follow_up_id, 'checklist_updated'
  );
  return jsonb_build_object('status', 'ok', 'follow_up_id', v_follow_up_id);
end;
$$;

create or replace function public.reschedule_follow_up(
  p_follow_up_id uuid,
  p_due_date date,
  p_due_time time,
  p_scope text,
  p_recurrence jsonb,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_existing public.follow_ups%rowtype;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_existing from public.follow_ups where id = p_follow_up_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_existing.version is distinct from p_version then
    return jsonb_build_object('status', 'conflict', 'message', 'Follow-up changed elsewhere.');
  end if;
  if v_existing.status <> 'Open' or p_scope not in ('occurrence', 'future') then
    return jsonb_build_object('status', 'invalid', 'message', 'Follow-up cannot be rescheduled.');
  end if;
  update public.follow_ups set due_date = p_due_date, due_time = p_due_time,
    version = version + 1 where id = p_follow_up_id;
  if p_scope = 'future' and v_existing.series_id is not null then
    update public.follow_up_series set
      due_time = p_due_time,
      recurrence_rule = coalesce(nullif(p_recurrence ->> 'recurrence_rule', ''), recurrence_rule),
      frequency = coalesce(nullif(p_recurrence ->> 'frequency', ''), frequency),
      interval_count = coalesce(nullif(p_recurrence ->> 'interval_count', '')::integer, interval_count),
      weekdays = case when p_recurrence ? 'weekdays' then array(
        select value::smallint from jsonb_array_elements_text(p_recurrence -> 'weekdays')
      ) else weekdays end,
      month_anchor = coalesce(nullif(p_recurrence ->> 'month_anchor', '')::smallint, month_anchor),
      version = version + 1
    where id = v_existing.series_id;
  end if;
  insert into public.ops_activity_log (message, collection, record_id, action)
  -- Records old and new date AND time, so a time-only change is visible. A
  -- missing time renders as 'all day'. Every part is bounded (no user text):
  -- 27 prefix + 13 date + 10 time + 4 separator + 13 date + 10 time = 77 at most.
  values (
    'Follow-up rescheduled from ' || coalesce(left(v_existing.due_date::text, 13), 'no date')
      || coalesce(' at ' || left(v_existing.due_time::text, 5), ' (all day)')
      || ' to ' || coalesce(left(p_due_date::text, 13), 'no date')
      || coalesce(' at ' || left(p_due_time::text, 5), ' (all day)'),
    'follow_ups', p_follow_up_id, 'rescheduled'
  );
  return jsonb_build_object('status', 'ok', 'follow_up_id', p_follow_up_id);
end;
$$;

create or replace function public.create_follow_up_successor(
  p_current public.follow_ups,
  p_series public.follow_up_series,
  p_next_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_next_id uuid;
begin
  if p_next_due_date is null or p_next_due_date <= p_current.due_date then return null; end if;
  if p_series.ends_on is not null and p_next_due_date > p_series.ends_on then return null; end if;
  if p_series.max_occurrences is not null
    and p_series.occurrences_created >= p_series.max_occurrences then return null; end if;

  insert into public.follow_ups (
    client_id, contact_id, enquiry_id, project_id, follow_up_type, custom_type,
    title, overview, notes, due_date, due_time, priority, contact_methods,
    owner_user_id, owner_name, owner_email, series_id, occurrence_number
  ) values (
    p_series.client_id, p_series.contact_id, p_series.enquiry_id, p_series.project_id,
    p_series.follow_up_type, p_series.custom_type, p_series.title, p_series.overview,
    p_series.notes, p_next_due_date, p_series.due_time, p_series.priority,
    p_series.contact_methods, p_series.owner_user_id, p_series.owner_name,
    p_series.owner_email, p_series.id, p_current.occurrence_number + 1
  ) returning id into v_next_id;

  insert into public.follow_up_checklist_items (follow_up_id, label, sort_order)
  select v_next_id, label, ordinality - 1
  from unnest(p_series.checklist_template) with ordinality item(label, ordinality);
  update public.follow_up_series set occurrences_created = occurrences_created + 1,
    version = version + 1 where id = p_series.id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Recurring follow-up created', 'follow_ups', v_next_id, 'recurrence_created');
  return v_next_id;
end;
$$;

revoke all on function public.create_follow_up_successor(
  public.follow_ups, public.follow_up_series, date
) from public, anon, authenticated, service_role;

create or replace function public.complete_follow_up(
  p_follow_up_id uuid,
  p_outcome text,
  p_next_due_date date,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.follow_ups%rowtype;
  v_series public.follow_up_series%rowtype;
  v_next_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_current from public.follow_ups where id = p_follow_up_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_current.status = 'Completed' then
    return jsonb_build_object(
      'status', 'ok', 'follow_up_id', p_follow_up_id, 'successor_id', v_current.successor_id
    );
  end if;
  if v_current.version is distinct from p_version then
    return jsonb_build_object('status', 'conflict', 'message', 'Follow-up changed elsewhere.');
  end if;
  if v_current.status <> 'Open' then
    return jsonb_build_object('status', 'invalid', 'message', 'Follow-up is not open.');
  end if;
  if v_current.series_id is not null then
    select * into v_series from public.follow_up_series
    where id = v_current.series_id for update;
    if v_series.active then
      v_next_id := public.create_follow_up_successor(v_current, v_series, p_next_due_date);
      if v_next_id is null then
        update public.follow_up_series set active = false, version = version + 1
        where id = v_series.id;
      end if;
    end if;
  end if;
  update public.follow_ups set status = 'Completed', outcome = nullif(btrim(p_outcome), ''),
    completed_at = now(), cancellation_reason = null, cancelled_at = null,
    successor_id = v_next_id, version = version + 1 where id = p_follow_up_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  values (
    -- ops_activity_log rejects messages over 200 characters, so every user-supplied part is
    -- capped: 21 prefix + 80 title + 12 label + 80 outcome = 193 at most.
    'Follow-up completed: ' || left(v_current.title, 80)
      || case when nullif(btrim(p_outcome), '') is null then ''
         else ' | Outcome: ' || left(btrim(p_outcome), 80) end,
    'follow_ups', p_follow_up_id, 'completed'
  );
  return jsonb_build_object(
    'status', 'ok', 'follow_up_id', p_follow_up_id, 'successor_id', v_next_id
  );
end;
$$;

create or replace function public.cancel_follow_up(
  p_follow_up_id uuid,
  p_reason text,
  p_scope text,
  p_next_due_date date,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.follow_ups%rowtype;
  v_series public.follow_up_series%rowtype;
  v_next_id uuid;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if coalesce(btrim(p_reason), '') = '' or p_scope not in ('occurrence', 'series') then
    return jsonb_build_object('status', 'invalid', 'message', 'Cancellation reason is required.');
  end if;
  select * into v_current from public.follow_ups where id = p_follow_up_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_current.status = 'Cancelled' then
    return jsonb_build_object(
      'status', 'ok', 'follow_up_id', p_follow_up_id, 'successor_id', v_current.successor_id
    );
  end if;
  if v_current.version is distinct from p_version then
    return jsonb_build_object('status', 'conflict', 'message', 'Follow-up changed elsewhere.');
  end if;
  if v_current.status <> 'Open' then
    return jsonb_build_object('status', 'invalid', 'message', 'Follow-up is not open.');
  end if;
  if v_current.series_id is not null then
    select * into v_series from public.follow_up_series
    where id = v_current.series_id for update;
    if p_scope = 'series' then
      update public.follow_up_series set active = false, version = version + 1
      where id = v_series.id;
    elsif v_series.active then
      v_next_id := public.create_follow_up_successor(v_current, v_series, p_next_due_date);
      if v_next_id is null then
        update public.follow_up_series set active = false, version = version + 1
        where id = v_series.id;
      end if;
    end if;
  end if;
  update public.follow_ups set status = 'Cancelled', cancellation_reason = btrim(p_reason),
    cancelled_at = now(), outcome = null, completed_at = null,
    successor_id = v_next_id, version = version + 1 where id = p_follow_up_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  -- Capped (21 prefix + 170 reason = 191) so a long reason, which the schema allows up to
  -- 1000 characters, can never push the message past ops_activity_log's 200-character limit.
  values (
    'Follow-up cancelled: ' || left(btrim(p_reason), 170),
    'follow_ups', p_follow_up_id, 'cancelled'
  );
  return jsonb_build_object(
    'status', 'ok', 'follow_up_id', p_follow_up_id, 'successor_id', v_next_id
  );
end;
$$;

create or replace function public.reopen_follow_up(
  p_follow_up_id uuid,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_current public.follow_ups%rowtype;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  select * into v_current from public.follow_ups where id = p_follow_up_id for update;
  if not found then return jsonb_build_object('status', 'not-found'); end if;
  if v_current.version is distinct from p_version then
    return jsonb_build_object('status', 'conflict', 'message', 'Follow-up changed elsewhere.');
  end if;
  if v_current.status not in ('Completed', 'Cancelled') then
    return jsonb_build_object('status', 'invalid', 'message', 'Follow-up is already open.');
  end if;
  if v_current.successor_id is not null then
    return jsonb_build_object(
      'status', 'conflict', 'message', 'Open the current recurring occurrence instead.',
      'successor_id', v_current.successor_id
    );
  end if;
  update public.follow_ups set status = 'Open', outcome = null, cancellation_reason = null,
    completed_at = null, cancelled_at = null, version = version + 1
  where id = p_follow_up_id;
  insert into public.ops_activity_log (message, collection, record_id, action)
  -- Reopening clears the outcome / cancellation reason columns, so the activity log is where
  -- that history is kept. Capped to stay within 200 characters:
  -- 20 prefix + 60 title + 3 separator + 29 label + 80 text = 192 at most.
  values (
    'Follow-up reopened: ' || left(v_current.title, 60)
      || case
        when nullif(btrim(v_current.outcome), '') is not null
          then ' | Cleared outcome: ' || left(btrim(v_current.outcome), 80)
        when nullif(btrim(v_current.cancellation_reason), '') is not null
          then ' | Cleared cancellation reason: ' || left(btrim(v_current.cancellation_reason), 80)
        else '' end,
    'follow_ups', p_follow_up_id, 'reopened'
  );
  return jsonb_build_object('status', 'ok', 'follow_up_id', p_follow_up_id);
end;
$$;

revoke all on function public.create_follow_up(jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_follow_up(uuid, jsonb, jsonb, jsonb, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.set_follow_up_checklist_item(uuid, boolean, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.reschedule_follow_up(uuid, date, time, text, jsonb, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_follow_up(uuid, text, date, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.cancel_follow_up(uuid, text, text, date, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.reopen_follow_up(uuid, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.create_follow_up(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_follow_up(uuid, jsonb, jsonb, jsonb, text, integer)
  to authenticated;
grant execute on function public.set_follow_up_checklist_item(uuid, boolean, integer)
  to authenticated;
grant execute on function public.reschedule_follow_up(uuid, date, time, text, jsonb, integer)
  to authenticated;
grant execute on function public.complete_follow_up(uuid, text, date, integer) to authenticated;
grant execute on function public.cancel_follow_up(uuid, text, text, date, integer)
  to authenticated;
grant execute on function public.reopen_follow_up(uuid, integer) to authenticated;

commit;
