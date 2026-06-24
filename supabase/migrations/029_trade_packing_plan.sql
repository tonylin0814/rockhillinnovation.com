create table if not exists public.trade_packing_plans (
  id                    uuid primary key default gen_random_uuid(),
  trade_id              uuid not null references public.trades(id) on delete cascade,
  container_type        text not null default '40hq'
    check (container_type in ('20ft', '40ft', '40hq')),
  pallet_length_cm      numeric(8,2) not null,
  pallet_width_cm       numeric(8,2) not null,
  pallet_height_cm      numeric(8,2) not null,
  pallet_max_weight_kg  numeric(8,2) not null,
  forklift_clearance_cm numeric(8,2) not null default 30,
  status                text not null default 'draft'
    check (status in ('draft', 'confirmed')),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (trade_id)
);

create table if not exists public.trade_packing_pallets (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.trade_packing_plans(id) on delete cascade,
  pallet_number   int not null,
  pallet_label    text not null,
  is_mixed        boolean not null default false,
  total_cases     int not null default 0,
  total_weight_kg numeric(10,3),
  notes           text,
  sort_order      int not null default 0,
  unique (plan_id, pallet_number)
);

create table if not exists public.trade_packing_cases (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.trade_packing_plans(id) on delete cascade,
  pallet_id    uuid not null references public.trade_packing_pallets(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  product_code text not null,
  product_name text not null,
  case_number  int not null,
  case_label   text not null,
  qty_in_case  int not null,
  weight_kg    numeric(10,3) not null,
  sort_order   int not null default 0
);

create index if not exists trade_packing_plans_trade_id_idx on public.trade_packing_plans(trade_id);
create index if not exists trade_packing_pallets_plan_id_idx on public.trade_packing_pallets(plan_id);
create index if not exists trade_packing_cases_plan_id_idx on public.trade_packing_cases(plan_id);
create index if not exists trade_packing_cases_pallet_id_idx on public.trade_packing_cases(pallet_id);
create index if not exists trade_packing_cases_product_id_idx on public.trade_packing_cases(product_id);

alter table public.trade_packing_plans enable row level security;
alter table public.trade_packing_pallets enable row level security;
alter table public.trade_packing_cases enable row level security;

drop policy if exists "managers_all_packing_plans" on public.trade_packing_plans;
create policy "managers_all_packing_plans"
  on public.trade_packing_plans for all
  using (exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','manager')))
  with check (exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','manager')));

drop policy if exists "managers_all_packing_pallets" on public.trade_packing_pallets;
create policy "managers_all_packing_pallets"
  on public.trade_packing_pallets for all
  using (exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','manager')))
  with check (exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','manager')));

drop policy if exists "managers_all_packing_cases" on public.trade_packing_cases;
create policy "managers_all_packing_cases"
  on public.trade_packing_cases for all
  using (exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','manager')))
  with check (exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin','manager')));
