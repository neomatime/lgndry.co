-- Restrict admin-only tables (and the media bucket) to admins.
--
-- Problem: fifteen tables carry `authenticated_full_access`
-- (USING/WITH CHECK auth.role() = 'authenticated'), so ANY signed-in user --
-- including a customer who registered on the public site -- could read, change
-- and delete client records, invoices, projects and the catalogue through the
-- API. The media storage bucket had the same "any authenticated user" rule.
--
-- Fix: admin-only access via the existing public.is_admin(uuid) helper
-- (membership of public.admin_users), matching the emails / orders /
-- email_sync_state policies that are already correct.
--
-- Side effect handled here: the public policies below are `TO anon` only, so
-- a signed-in non-admin (customer, or staff browsing the public site) was
-- served by the broad policy instead. They are widened to `anon, authenticated`
-- so signed-in visitors can still read the catalogue/site content and submit
-- enquiry forms, and only those.
--
-- Not affected: the Titan inbox sync (api/sync-titan-inbox.js) and the DB
-- triggers use the service role / SECURITY DEFINER and bypass RLS.
--
-- Rollback: 20260926_restrict_admin_tables_to_admins.rollback.sql

begin;

-- 1. Signed-in visitors keep exactly the public access anon already has.
alter policy public_insert_enquiry        on public.bookings         to anon, authenticated;
alter policy public_insert_lead           on public.clients          to anon, authenticated;
alter policy public_insert_application    on public.partnerships     to anon, authenticated;
alter policy public_insert_activity       on public.ops_activity_log to anon, authenticated;
alter policy public_read_visible          on public.budgets          to anon, authenticated;
alter policy public_read_published        on public.cms              to anon, authenticated;
alter policy public_read_available        on public.collection       to anon, authenticated;
alter policy public_read_visible          on public.practice         to anon, authenticated;
alter policy public_read_gallery          on public.galleries        to anon, authenticated;
alter policy public_update_gallery_status on public.galleries        to anon, authenticated;

-- 2. Replace "any signed-in user" with "admins" on every admin-only table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bookings', 'budgets', 'clients', 'cms', 'collection', 'content',
    'documents', 'galleries', 'invoices', 'journal', 'ops_activity_log',
    'partnerships', 'practice', 'projects', 'push_subscriptions'
  ]
  loop
    execute format('drop policy authenticated_full_access on public.%I', t);
    execute format(
      'create policy admin_full_access on public.%I
         for all to authenticated
         using (public.is_admin((select auth.uid())))
         with check (public.is_admin((select auth.uid())))',
      t
    );
  end loop;
end
$$;

-- 3. Media bucket: reading stays public; writing is admin-only.
drop policy media_authenticated_upload on storage.objects;
drop policy media_authenticated_update on storage.objects;
drop policy media_authenticated_delete on storage.objects;

create policy media_admin_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin((select auth.uid())));

create policy media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin((select auth.uid())));

create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin((select auth.uid())));

commit;
