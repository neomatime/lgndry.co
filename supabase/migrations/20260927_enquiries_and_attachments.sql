-- Attachment pipeline and enquiry record.
--
-- New public "Start a Project" form (a later task) writes here through
-- submit_enquiry() only — there are no direct anon INSERT policies on
-- clients/enquiries/enquiry_attachments, because matching an enquiry to an
-- existing client requires reading `clients` by email first, and `anon`
-- must never be able to read that table directly (it would expose every
-- client's name, email and phone). The function does that lookup
-- internally and returns only the new enquiry id.
--
-- The existing Contact page, Booking dialog and Partnership dialog are
-- untouched: they keep writing into clients/bookings/partnerships exactly
-- as before. See docs/superpowers/specs/2026-09-27-attachment-pipeline-and-
-- enquiry-record-design.md for the full design.

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id),
  full_name text not null,
  company text,
  email text not null,
  phone text not null,
  project_type text not null,
  location text not null,
  timeline text not null,
  description text not null,
  budget text,
  status text not null default 'New'
    check (
      status in (
        'New', 'Reviewing', 'Quoted', 'Follow-up', 'Booked',
        'In Production', 'Completed', 'Closed'
      )
    ),
  source text not null default 'Website',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

create index enquiries_status_idx on public.enquiries (status);
create index enquiries_created_at_idx on public.enquiries (created_at desc);

alter table public.enquiries enable row level security;

create policy admin_full_access on public.enquiries
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create table public.enquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create index enquiry_attachments_enquiry_id_idx
  on public.enquiry_attachments (enquiry_id);

alter table public.enquiry_attachments enable row level security;

create policy admin_full_access on public.enquiry_attachments
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- Writes the client (matched by email, or newly created), the enquiry, and
-- its attachment rows in one transaction. status/archived are always
-- forced here, never taken from a caller-supplied value.
create or replace function public.submit_enquiry(
  full_name text,
  company text,
  email text,
  phone text,
  project_type text,
  location text,
  timeline text,
  description text,
  budget text,
  client_notes text,
  attachments jsonb default '[]'::jsonb
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
begin
  if project_type not in (
    'Documentary', 'Event', 'Film', 'Visual Production', 'Other'
  ) then
    raise exception 'invalid project_type: %', project_type;
  end if;
  if coalesce(trim(full_name), '') = '' or coalesce(trim(email), '') = '' then
    raise exception 'full_name and email are required';
  end if;

  select c.id into matched_client_id
  from public.clients c
  where c.archived = false
    and lower(c.email) = lower(submit_enquiry.email)
  order by c.created_at asc
  limit 1;

  if matched_client_id is null then
    insert into public.clients (name, type, contact, email, phone, status, notes)
    values (
      full_name,
      case when coalesce(trim(company), '') <> '' then 'Company' else 'Individual' end,
      full_name,
      email,
      phone,
      'Lead',
      client_notes
    )
    returning id into matched_client_id;
  end if;

  insert into public.enquiries (
    client_id, full_name, company, email, phone, project_type,
    location, timeline, description, budget, status, source, archived
  )
  values (
    matched_client_id, full_name, nullif(trim(company), ''), email, phone,
    project_type, location, timeline, description, nullif(trim(budget), ''),
    'New', 'Website', false
  )
  returning id into new_enquiry_id;

  for attachment in select * from jsonb_array_elements(coalesce(attachments, '[]'::jsonb))
  loop
    insert into public.enquiry_attachments (
      enquiry_id, storage_path, file_name, mime_type, size_bytes
    )
    values (
      new_enquiry_id,
      attachment ->> 'storage_path',
      attachment ->> 'file_name',
      attachment ->> 'mime_type',
      (attachment ->> 'size_bytes')::integer
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
) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'enquiry-attachments',
  'enquiry-attachments',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

create policy enquiry_attachments_anon_upload on storage.objects
  for insert to anon
  with check (bucket_id = 'enquiry-attachments');

create policy enquiry_attachments_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'enquiry-attachments'
    and public.is_admin((select auth.uid()))
  );
