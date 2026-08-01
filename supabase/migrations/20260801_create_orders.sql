-- LGNDRY.Co website order requests
-- Apply this migration to the Supabase project before enabling the live Orders module.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  "orderNumber" text not null unique,
  "customerName" text not null,
  "customerEmail" text not null,
  "customerPhone" text not null,
  items jsonb not null default '[]'::jsonb,
  "itemSummary" text not null,
  quantity integer not null default 1 check (quantity > 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  "deliveryMethod" text not null,
  "deliveryAddress" text not null,
  "deliveryCity" text not null,
  "postalCode" text not null,
  notes text,
  "submittedAt" timestamptz not null default now(),
  status text not null default 'New Request',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists orders_submitted_at_idx on public.orders ("submittedAt" desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

drop policy if exists "Website visitors can create order requests" on public.orders;
create policy "Website visitors can create order requests"
  on public.orders
  for insert
  to anon
  with check (status = 'New Request' and archived = false);

drop policy if exists "Authenticated team can manage orders" on public.orders;
create policy "Authenticated team can manage orders"
  on public.orders
  for all
  to authenticated
  using (true)
  with check (true);

grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
