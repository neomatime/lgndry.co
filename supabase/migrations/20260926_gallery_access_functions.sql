-- Server-checked access to client galleries.
--
-- The legacy gallery page read the whole `galleries` row as the anonymous role,
-- password included, and compared the password in the browser, so the password
-- protected nothing: anyone could read the files and password straight from the
-- API. These functions do the check inside the database and only ever return a
-- gallery's contents once the visitor has satisfied it. The password itself is
-- never returned.
--
-- Additive: nothing is dropped or narrowed here, so the legacy page keeps
-- working until it is retired. The matching clean-up (removing the anonymous
-- read/update access to the table) is in supabase/deferred/.
--
-- Visibility rules match the existing `public_read_gallery` policy: not
-- archived, not a draft, and not past its expiry date.

create or replace function public.gallery_access(gallery_id uuid, gallery_password text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.galleries%rowtype;
begin
  select * into g
  from public.galleries
  where id = gallery_id
    and archived = false
    and status <> 'Draft'
    and (expiry is null or expiry >= current_date);

  if not found then
    return jsonb_build_object('state', 'not_found');
  end if;

  if coalesce(g.password, '') <> '' then
    if coalesce(gallery_password, '') = '' then
      return jsonb_build_object('state', 'locked');
    end if;
    if gallery_password <> g.password then
      perform pg_sleep(0.6); -- slows down guessing
      return jsonb_build_object('state', 'wrong_password');
    end if;
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'gallery', jsonb_build_object(
      'id', g.id,
      'title', g.title,
      'files', g.files,
      'expiry', g.expiry,
      'downloads', g.downloads,
      'status', g.status
    )
  );
end;
$$;

-- Records that the client opened ('Viewed') or downloaded ('Downloaded') a
-- gallery, moving its status forward only: Sent -> Viewed -> Downloaded.
-- Password-protected galleries need the password, and a gallery with downloads
-- switched off can't be marked downloaded. Returns whether anything changed.
create or replace function public.gallery_mark(
  gallery_id uuid,
  new_status text,
  gallery_password text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.galleries%rowtype;
  changed integer := 0;
begin
  if new_status not in ('Viewed', 'Downloaded') then
    return false;
  end if;

  select * into g
  from public.galleries
  where id = gallery_id
    and archived = false
    and status <> 'Draft'
    and (expiry is null or expiry >= current_date);

  if not found then
    return false;
  end if;

  if coalesce(g.password, '') <> '' and coalesce(gallery_password, '') <> g.password then
    return false;
  end if;

  if new_status = 'Viewed' and g.status = 'Sent' then
    update public.galleries set status = 'Viewed' where id = g.id;
    get diagnostics changed = row_count;
  elsif new_status = 'Downloaded'
        and g.status in ('Sent', 'Viewed')
        and coalesce(g.downloads, 'Enabled') <> 'Disabled' then
    update public.galleries set status = 'Downloaded' where id = g.id;
    get diagnostics changed = row_count;
  end if;

  return changed > 0;
end;
$$;

revoke all on function public.gallery_access(uuid, text) from public;
revoke all on function public.gallery_mark(uuid, text, text) from public;
grant execute on function public.gallery_access(uuid, text) to anon, authenticated;
grant execute on function public.gallery_mark(uuid, text, text) to anon, authenticated;
