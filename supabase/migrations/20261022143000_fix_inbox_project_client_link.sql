begin;

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
    select 1 from public.projects where id = v_project_id and client = v_client_id
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

revoke all on function public.set_email_thread_state(uuid, text, integer)
  from public, anon, service_role;
revoke all on function public.link_email_thread(uuid, jsonb, integer)
  from public, anon, service_role;
grant execute on function public.set_email_thread_state(uuid, text, integer) to authenticated;
grant execute on function public.link_email_thread(uuid, jsonb, integer) to authenticated;

commit;
