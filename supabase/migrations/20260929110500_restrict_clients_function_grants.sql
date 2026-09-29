begin;

-- This project grants function EXECUTE directly to API roles by default.
-- Keep the client write RPCs available to authenticated callers (the
-- functions enforce admin membership) and prevent direct trigger invocation.
revoke all on function public.create_primary_contact_for_legacy_client()
  from public, anon, authenticated, service_role;

revoke all on function public.create_client_with_contacts(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_client_with_contacts(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.set_client_archived(uuid, boolean)
  from public, anon, authenticated, service_role;

grant execute on function public.create_client_with_contacts(jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.update_client_with_contacts(uuid, jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.set_client_archived(uuid, boolean)
  to authenticated, service_role;

commit;
