-- Rollback for 20260926_restrict_admin_tables_to_admins.sql
-- Restores the previous (insecure) "any signed-in user" policies.
-- Kept outside the numbered migration sequence on purpose: apply by hand only.

begin;

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
    execute format('drop policy admin_full_access on public.%I', t);
    execute format(
      'create policy authenticated_full_access on public.%I
         for all
         using (auth.role() = ''authenticated'')
         with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end
$$;

alter policy public_insert_enquiry        on public.bookings         to anon;
alter policy public_insert_lead           on public.clients          to anon;
alter policy public_insert_application    on public.partnerships     to anon;
alter policy public_insert_activity       on public.ops_activity_log to anon;
alter policy public_read_visible          on public.budgets          to anon;
alter policy public_read_published        on public.cms              to anon;
alter policy public_read_available        on public.collection       to anon;
alter policy public_read_visible          on public.practice         to anon;
alter policy public_read_gallery          on public.galleries        to anon;
alter policy public_update_gallery_status on public.galleries        to anon;

drop policy media_admin_upload on storage.objects;
drop policy media_admin_update on storage.objects;
drop policy media_admin_delete on storage.objects;

create policy media_authenticated_upload on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
create policy media_authenticated_update on storage.objects
  for update to authenticated using (bucket_id = 'media');
create policy media_authenticated_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media');

commit;
