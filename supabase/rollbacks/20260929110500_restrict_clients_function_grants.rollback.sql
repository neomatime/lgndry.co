begin;

grant execute on function public.create_primary_contact_for_legacy_client()
  to anon, authenticated, service_role;
grant execute on function public.create_client_with_contacts(jsonb, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.update_client_with_contacts(uuid, jsonb, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.set_client_archived(uuid, boolean)
  to anon, authenticated, service_role;

commit;
