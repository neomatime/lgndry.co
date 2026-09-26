-- DEFERRED: apply only when the legacy gallery.html is no longer in use.
-- (Not in supabase/migrations on purpose, so tooling never runs it by itself.)
--
-- Today the anonymous role can read every non-draft gallery in full (files and
-- password) and update any column of a 'Sent' or 'Viewed' gallery, not just its
-- status. The Next.js gallery page uses gallery_access()/gallery_mark()
-- (20260926_gallery_access_functions.sql) instead, so this direct access can go.
-- The legacy gallery.html reads the table directly and will stop working.
-- There were no galleries in the database when this was written (2026-09-26).
--
-- Rollback: recreate the two policies below (see 20260707202946 and
-- 20260729180404 in the migration history) and re-grant SELECT, UPDATE to anon.

begin;

drop policy if exists public_read_gallery on public.galleries;
drop policy if exists public_update_gallery_status on public.galleries;
revoke all on public.galleries from anon;

commit;
