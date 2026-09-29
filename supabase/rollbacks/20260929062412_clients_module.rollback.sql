begin;

drop function if exists public.create_client_with_contacts(jsonb, jsonb);
drop function if exists public.update_client_with_contacts(uuid, jsonb, jsonb);
drop function if exists public.set_client_archived(uuid, boolean);
drop trigger if exists create_primary_contact_after_client_insert on public.clients;
drop function if exists public.create_primary_contact_for_legacy_client();
drop table if exists public.client_contacts;

alter table public.clients
  drop constraint if exists clients_account_tier_check,
  drop constraint if exists clients_status_check,
  drop constraint if exists clients_type_check,
  drop column if exists account_tier,
  drop column if exists industry,
  drop column if exists region,
  drop column if exists client_since,
  drop column if exists account_overview,
  drop column if exists preferred_services,
  drop column if exists relationship_notes;

create or replace function public.submit_enquiry(
  full_name text, company text, email text, phone text, project_type text,
  location text, timeline text, description text, budget text,
  client_notes text, attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
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
  if coalesce(trim(full_name), '') = '' or coalesce(trim(email), '') = '' then
    raise exception 'full_name and email are required';
  end if;
  if length(full_name) > 200 then raise exception 'full_name too long (max 200 characters)'; end if;
  if length(coalesce(company, '')) > 200 then raise exception 'company too long (max 200 characters)'; end if;
  if length(email) > 320 then raise exception 'email too long (max 320 characters)'; end if;
  if length(coalesce(phone, '')) > 50 then raise exception 'phone too long (max 50 characters)'; end if;
  if length(coalesce(location, '')) > 200 then raise exception 'location too long (max 200 characters)'; end if;
  if length(coalesce(timeline, '')) > 200 then raise exception 'timeline too long (max 200 characters)'; end if;
  if length(coalesce(description, '')) > 5000 then raise exception 'description too long (max 5000 characters)'; end if;
  if length(coalesce(budget, '')) > 200 then raise exception 'budget too long (max 200 characters)'; end if;
  if length(coalesce(client_notes, '')) > 2000 then raise exception 'client_notes too long (max 2000 characters)'; end if;
  if jsonb_array_length(coalesce(attachments, '[]'::jsonb)) > 5 then
    raise exception 'too many attachments: %', jsonb_array_length(attachments);
  end if;

  select c.id into matched_client_id
  from public.clients c
  where c.archived = false and lower(c.email) = lower(submit_enquiry.email)
  order by c.created_at asc limit 1;

  if matched_client_id is null then
    insert into public.clients (name, type, contact, email, phone, status, notes)
    values (
      full_name,
      case when coalesce(trim(company), '') <> '' then 'Company' else 'Individual' end,
      full_name, email, phone, 'Lead', client_notes
    ) returning id into matched_client_id;
  end if;

  insert into public.enquiries (
    client_id, full_name, company, email, phone, project_type,
    location, timeline, description, budget, status, source, archived
  ) values (
    matched_client_id, full_name, nullif(trim(company), ''), email, phone,
    project_type, location, timeline, description, nullif(trim(budget), ''),
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
