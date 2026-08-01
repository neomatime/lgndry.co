-- LGNDRY.Co collection commerce fields and manual-payment order workflow.

alter table public.collection
  add column if not exists artist text not null default 'Dan Mokgwadi',
  add column if not exists medium text not null default 'Archival Pigment Print',
  add column if not exists dimensions text not null default '',
  add column if not exists "framingOptions" text not null default 'Unframed',
  add column if not exists "deliveryEstimate" text not null default '7–14 business days after payment confirmation',
  add column if not exists featured boolean not null default false,
  add column if not exists popularity integer not null default 0,
  add column if not exists "requiresConfirmation" boolean not null default false,
  add column if not exists "publishedAt" timestamptz not null default now();

update public.collection
set medium = coalesce(nullif("seriesLabel", ''), 'Archival Pigment Print'),
    dimensions = coalesce(nullif(sizes, ''), dimensions),
    "requiresConfirmation" = case
      when availability in ('Reserved', 'Sold Out') then true
      else "requiresConfirmation"
    end
where true;

alter table public.orders
  add column if not exists "orderType" text not null default 'Order Request',
  add column if not exists "paymentMethod" text not null default 'EFT',
  add column if not exists "paymentStatus" text not null default 'Awaiting Payment',
  add column if not exists "fulfilmentStatus" text not null default 'Awaiting Confirmation',
  add column if not exists "deliveryFee" numeric(12,2) not null default 0 check ("deliveryFee" >= 0),
  add column if not exists "grandTotal" numeric(12,2) not null default 0 check ("grandTotal" >= 0),
  add column if not exists "billingName" text not null default '',
  add column if not exists "billingAddress" text not null default '',
  add column if not exists "billingCity" text not null default '',
  add column if not exists "billingPostalCode" text not null default '',
  add column if not exists "internalNotes" text not null default '';

update public.orders
set "grandTotal" = subtotal + coalesce("deliveryFee", 0)
where "grandTotal" = 0 and subtotal > 0;

alter table public.orders alter column status set default 'New';

drop policy if exists "Website visitors can create order requests" on public.orders;
drop policy if exists "Customers can create own orders" on public.orders;

create policy "Website visitors can create order requests"
  on public.orders for insert to anon
  with check (
    customer_id is null
    and status in ('New', 'New Request')
    and "paymentStatus" in ('Awaiting Payment', 'Not Required')
    and archived = false
  );

create policy "Customers can create own orders"
  on public.orders for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status in ('New', 'New Request')
    and "paymentStatus" in ('Awaiting Payment', 'Not Required')
    and archived = false
  );

create index if not exists collection_commerce_filter_idx
  on public.collection (category, "collectionName", artist, availability, price);
create index if not exists orders_order_type_idx on public.orders ("orderType");
create index if not exists orders_payment_status_idx on public.orders ("paymentStatus");
create index if not exists orders_fulfilment_status_idx on public.orders ("fulfilmentStatus");
