-- This project has default function privileges that grant EXECUTE directly to
-- anon and authenticated. Revoke those direct grants as well as PUBLIC so the
-- upload-session API remains service-role-only.

revoke all on function public.create_enquiry_upload_session(uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_enquiry_upload_session(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_enquiry_upload_session_failed(uuid)
  from public, anon, authenticated;
revoke all on function public.list_expired_enquiry_upload_sessions(integer)
  from public, anon, authenticated;
revoke all on function public.mark_enquiry_upload_session_expired(uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_enquiry_upload_session(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
