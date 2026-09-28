-- DEFERRED: apply only after the signed-upload production code is live.
-- (Not in supabase/migrations on purpose, so tooling never runs it by itself.)
--
-- Rollback: recreate enquiry_attachments_anon_upload exactly as recorded in
-- 20260927_enquiries_and_attachments.sql, then grant submit_enquiry execute to
-- anon and authenticated.

begin;

drop policy if exists enquiry_attachments_anon_upload on storage.objects;

revoke execute on function public.submit_enquiry(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from anon, authenticated;

commit;
