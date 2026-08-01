-- LGNDRY.Co customer accounts, order ownership, and status history.
-- Apply after 20260801_create_orders.sql and before enabling the customer portal.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Existing authenticated accounts pre-date the customer portal and are the studio team.
-- Run this migration before inviting customers so only current team accounts are grandfathered.
insert into public.admin_users (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.admin_users enable row level security;

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = check_user);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

drop policy if exists "Admins can view admin users" on public.admin_users;
create policy "Admins can view admin users"
  on public.admin_users for select to authenticated
  using (public.is_admin(auth.uid()));

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists "Customers can view own profile" on public.customer_profiles;
create policy "Customers can view own profile"
  on public.customer_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Customers can update own profile" on public.customer_profiles;
create policy "Customers can update own profile"
  on public.customer_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Customers can insert own profile" on public.customer_profiles;
create policy "Customers can insert own profile"
  on public.customer_profiles for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select, insert, update on public.customer_profiles to authenticated;

alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists "statusHistory" jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists orders_customer_id_idx on public.orders (customer_id);

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_time timestamptz := now();
begin
  new.updated_at := event_time;
  if tg_op = 'INSERT' then
    if coalesce(jsonb_array_length(new."statusHistory"), 0) = 0 then
      new."statusHistory" := jsonb_build_array(jsonb_build_object(
        'status', new.status,
        'at', coalesce(new."submittedAt", event_time)
      ));
    end if;
  elsif new.status is distinct from old.status then
    new."statusHistory" := coalesce(old."statusHistory", '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'status', new.status,
      'at', event_time
    ));
  end if;
  return new;
end;
$$;

update public.orders
set "statusHistory" = jsonb_build_array(jsonb_build_object(
  'status', status,
  'at', coalesce("submittedAt", created_at, now())
))
where coalesce(jsonb_array_length("statusHistory"), 0) = 0;
drop trigger if exists orders_status_history_trigger on public.orders;
create trigger orders_status_history_trigger
  before insert or update of status on public.orders
  for each row execute function public.record_order_status_change();

create or replace function public.sync_customer_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles (user_id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (user_id) do update set
    full_name = case when excluded.full_name <> '' then excluded.full_name else customer_profiles.full_name end,
    email = excluded.email,
    updated_at = now();

  if new.email_confirmed_at is not null and new.email is not null then
    update public.orders
      set customer_id = new.id
      where customer_id is null
        and lower(trim("customerEmail")) = lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists customer_account_sync_trigger on auth.users;
create trigger customer_account_sync_trigger
  after insert or update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.sync_customer_account();

-- Backfill profiles and securely link orders for already verified users.
insert into public.customer_profiles (user_id, full_name, email, phone)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), coalesce(email, ''), coalesce(raw_user_meta_data ->> 'phone', '')
from auth.users
on conflict (user_id) do nothing;

update public.orders o
set customer_id = u.id
from auth.users u
where o.customer_id is null
  and u.email_confirmed_at is not null
  and lower(trim(o."customerEmail")) = lower(trim(u.email));

-- Replace the previous broad authenticated policy with ownership-aware policies.
drop policy if exists "Website visitors can create order requests" on public.orders;
drop policy if exists "Authenticated team can manage orders" on public.orders;
drop policy if exists "Customers can view own orders" on public.orders;
drop policy if exists "Customers can create own orders" on public.orders;
drop policy if exists "Admins can manage orders" on public.orders;

create policy "Website visitors can create order requests"
  on public.orders for insert to anon
  with check (customer_id is null and status = 'New Request' and archived = false);

create policy "Customers can create own orders"
  on public.orders for insert to authenticated
  with check (customer_id = auth.uid() and status = 'New Request' and archived = false);

create policy "Customers can view own orders"
  on public.orders for select to authenticated
  using (customer_id = auth.uid() and archived = false);

create policy "Admins can manage orders"
  on public.orders for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
