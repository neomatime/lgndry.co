-- Singleton workspace and commercial defaults for the OPS Command Center.

begin;

create table public.ops_settings (
  id uuid primary key default '00000000-0000-4000-8000-000000000001'::uuid,
  workspace_name text not null,
  company_email text not null,
  company_phone text not null default '',
  website_url text not null default '',
  business_address text not null default '',
  registration_number text not null default '',
  time_zone text not null default 'Africa/Johannesburg',
  currency text not null default 'ZAR',
  default_quote_terms text not null default '',
  default_retainer_percentage numeric(5, 2) not null default 50,
  default_quote_validity_days integer not null default 7,
  default_deposit_due_days integer not null default 3,
  bank_name text not null default '',
  account_holder text not null default '',
  account_number text not null default '',
  branch_code text not null default '',
  account_type text not null default '',
  payment_reference_instructions text not null default '',
  sender_name text not null,
  sender_email text not null,
  reply_to_email text not null,
  version integer not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_settings_singleton_check
    check (id = '00000000-0000-4000-8000-000000000001'::uuid),
  constraint ops_settings_workspace_name_check
    check (length(btrim(workspace_name)) between 1 and 160),
  constraint ops_settings_company_email_check
    check (
      length(btrim(company_email)) between 3 and 254
      and btrim(company_email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint ops_settings_company_phone_check check (length(company_phone) <= 50),
  constraint ops_settings_website_url_check check (
    length(website_url) <= 500 and (website_url = '' or website_url ~* '^https?://')
  ),
  constraint ops_settings_business_address_check check (length(business_address) <= 2000),
  constraint ops_settings_registration_number_check check (length(registration_number) <= 120),
  constraint ops_settings_time_zone_check check (time_zone = 'Africa/Johannesburg'),
  constraint ops_settings_currency_check check (currency = 'ZAR'),
  constraint ops_settings_quote_terms_check check (length(default_quote_terms) <= 10000),
  constraint ops_settings_retainer_check
    check (default_retainer_percentage > 0 and default_retainer_percentage <= 100),
  constraint ops_settings_quote_validity_check
    check (default_quote_validity_days between 1 and 365),
  constraint ops_settings_deposit_due_check
    check (default_deposit_due_days between 1 and 365),
  constraint ops_settings_bank_name_check check (length(bank_name) <= 160),
  constraint ops_settings_account_holder_check check (length(account_holder) <= 160),
  constraint ops_settings_account_number_check check (length(account_number) <= 80),
  constraint ops_settings_branch_code_check check (length(branch_code) <= 40),
  constraint ops_settings_account_type_check check (length(account_type) <= 80),
  constraint ops_settings_payment_reference_check
    check (length(payment_reference_instructions) <= 1000),
  constraint ops_settings_sender_name_check
    check (length(btrim(sender_name)) between 1 and 160),
  constraint ops_settings_sender_email_check
    check (
      length(btrim(sender_email)) between 3 and 254
      and btrim(sender_email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint ops_settings_reply_to_email_check
    check (
      length(btrim(reply_to_email)) between 3 and 254
      and btrim(reply_to_email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint ops_settings_version_check check (version > 0)
);

create trigger set_updated_at
  before update on public.ops_settings
  for each row execute function public.set_updated_at();

insert into public.ops_settings (
  id,
  workspace_name,
  company_email,
  website_url,
  time_zone,
  currency,
  default_retainer_percentage,
  default_quote_validity_days,
  default_deposit_due_days,
  sender_name,
  sender_email,
  reply_to_email
) values (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'LGNDRY.Co',
  'info@lgndry-co.co.za',
  'https://www.lgndry-co.co.za',
  'Africa/Johannesburg',
  'ZAR',
  50,
  7,
  3,
  'LGNDRY.Co',
  'info@lgndry-co.co.za',
  'info@lgndry-co.co.za'
);

alter table public.ops_settings enable row level security;
revoke all on table public.ops_settings from public, anon, authenticated, service_role;
grant select on table public.ops_settings to authenticated;

create policy admin_select on public.ops_settings
  for select to authenticated
  using (public.is_admin((select auth.uid())));

create or replace function public.update_ops_settings(
  p_settings jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_existing public.ops_settings%rowtype;
  v_workspace_name text := btrim(coalesce(p_settings ->> 'workspace_name', ''));
  v_company_email text := lower(btrim(coalesce(p_settings ->> 'company_email', '')));
  v_company_phone text := btrim(coalesce(p_settings ->> 'company_phone', ''));
  v_website_url text := btrim(coalesce(p_settings ->> 'website_url', ''));
  v_business_address text := btrim(coalesce(p_settings ->> 'business_address', ''));
  v_registration_number text := btrim(coalesce(p_settings ->> 'registration_number', ''));
  v_time_zone text := btrim(coalesce(p_settings ->> 'time_zone', ''));
  v_currency text := btrim(coalesce(p_settings ->> 'currency', ''));
  v_default_quote_terms text := btrim(coalesce(p_settings ->> 'default_quote_terms', ''));
  v_default_retainer_percentage numeric;
  v_default_quote_validity_days integer;
  v_default_deposit_due_days integer;
  v_bank_name text := btrim(coalesce(p_settings ->> 'bank_name', ''));
  v_account_holder text := btrim(coalesce(p_settings ->> 'account_holder', ''));
  v_account_number text := btrim(coalesce(p_settings ->> 'account_number', ''));
  v_branch_code text := btrim(coalesce(p_settings ->> 'branch_code', ''));
  v_account_type text := btrim(coalesce(p_settings ->> 'account_type', ''));
  v_payment_reference_instructions text := btrim(
    coalesce(p_settings ->> 'payment_reference_instructions', '')
  );
  v_sender_name text := btrim(coalesce(p_settings ->> 'sender_name', ''));
  v_sender_email text := lower(btrim(coalesce(p_settings ->> 'sender_email', '')));
  v_reply_to_email text := lower(btrim(coalesce(p_settings ->> 'reply_to_email', '')));
  v_version integer;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  select * into v_existing
  from public.ops_settings
  where id = v_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'workspace settings not found';
  end if;

  if v_existing.version is distinct from p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', v_existing.version);
  end if;

  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid settings payload';
  end if;

  begin
    v_default_retainer_percentage := (p_settings ->> 'default_retainer_percentage')::numeric;
    v_default_quote_validity_days := (p_settings ->> 'default_quote_validity_days')::integer;
    v_default_deposit_due_days := (p_settings ->> 'default_deposit_due_days')::integer;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'invalid settings payload';
  end;

  if length(v_workspace_name) not between 1 and 160
     or v_company_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_company_email) > 254
     or length(v_company_phone) > 50
     or length(v_website_url) > 500
     or (v_website_url <> '' and v_website_url !~* '^https?://')
     or length(v_business_address) > 2000
     or length(v_registration_number) > 120
     or v_time_zone <> 'Africa/Johannesburg'
     or v_currency <> 'ZAR'
     or length(v_default_quote_terms) > 10000
     or v_default_retainer_percentage is null
     or v_default_retainer_percentage <= 0
     or v_default_retainer_percentage > 100
     or v_default_quote_validity_days is null
     or v_default_quote_validity_days not between 1 and 365
     or v_default_deposit_due_days is null
     or v_default_deposit_due_days not between 1 and 365
     or length(v_bank_name) > 160
     or length(v_account_holder) > 160
     or length(v_account_number) > 80
     or length(v_branch_code) > 40
     or length(v_account_type) > 80
     or length(v_payment_reference_instructions) > 1000
     or length(v_sender_name) not between 1 and 160
     or v_sender_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_sender_email) > 254
     or v_reply_to_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_reply_to_email) > 254 then
    raise exception using errcode = '22023', message = 'invalid settings payload';
  end if;

  update public.ops_settings set
    workspace_name = v_workspace_name,
    company_email = v_company_email,
    company_phone = v_company_phone,
    website_url = v_website_url,
    business_address = v_business_address,
    registration_number = v_registration_number,
    time_zone = v_time_zone,
    currency = v_currency,
    default_quote_terms = v_default_quote_terms,
    default_retainer_percentage = v_default_retainer_percentage,
    default_quote_validity_days = v_default_quote_validity_days,
    default_deposit_due_days = v_default_deposit_due_days,
    bank_name = v_bank_name,
    account_holder = v_account_holder,
    account_number = v_account_number,
    branch_code = v_branch_code,
    account_type = v_account_type,
    payment_reference_instructions = v_payment_reference_instructions,
    sender_name = v_sender_name,
    sender_email = v_sender_email,
    reply_to_email = v_reply_to_email,
    version = version + 1,
    updated_by = (select auth.uid())
  where id = v_id
  returning version into v_version;

  insert into public.ops_activity_log (message, collection, record_id, action)
  values ('Workspace settings updated', 'settings', v_id, 'updated');

  return jsonb_build_object('status', 'ok', 'version', v_version);
end;
$$;

revoke all on function public.update_ops_settings(jsonb, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.update_ops_settings(jsonb, integer)
  to authenticated;

commit;
