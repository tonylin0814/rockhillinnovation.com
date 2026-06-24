-- Company settings (single row — Rock Hill Innovation's own info)
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'Rock Hill Innovation Co., Ltd',
  company_name_full text,
  address_line1 text,
  address_line2 text,
  city_state text,
  country text,
  phone text,
  email text,
  website text,
  sales_contact_name text,
  sales_contact_email text,
  sales_contact_phone text,
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

create policy "admins_all_company_settings"
  on public.company_settings
  for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

insert into public.company_settings (
  company_name,
  company_name_full,
  address_line1,
  address_line2,
  city_state,
  country,
  phone,
  email,
  website
) values (
  'Rock Hill Innovation Co., Ltd',
  'Rock Hill Innovation Co., Ltd',
  '5F., No. 7, Ln. 332, Sec. 2, Zhongshan Rd., Zhonghe Dist.',
  null,
  'New Taipei City, Taiwan 235026',
  'Taiwan',
  '(+886)2-22452580',
  'packaging@rockhill.com.tw',
  'www.rockhillinnovation.com'
) on conflict do nothing;

-- Company banking accounts (Rock Hill Innovation's own wire details)
create table if not exists public.company_banking_accounts (
  id uuid primary key default gen_random_uuid(),
  currency text not null,
  label text,
  bank_name text not null,
  bank_branch text,
  bank_address text,
  account_name text not null,
  account_number text,
  swift_code text,
  routing_number text,
  iban text,
  intermediary_bank text,
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.company_banking_accounts enable row level security;

create policy "admins_all_company_banking"
  on public.company_banking_accounts
  for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );
