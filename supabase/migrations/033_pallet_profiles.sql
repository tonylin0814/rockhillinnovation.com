create table if not exists public.pallet_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material text not null default 'wood'
    check (material in ('wood', 'plastic', 'paper_honeycomb')),
  length_cm numeric(8,2) not null,
  width_cm numeric(8,2) not null,
  height_cm numeric(8,2) not null,
  max_weight_kg numeric(8,2) not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pallet_profiles enable row level security;

drop policy if exists "managers_all_pallet_profiles" on public.pallet_profiles;
create policy "managers_all_pallet_profiles"
  on public.pallet_profiles for all
  to authenticated
  using (exists (
    select 1 from public.users
    where id = (select auth.uid()) and role in ('admin', 'manager')
  ))
  with check (exists (
    select 1 from public.users
    where id = (select auth.uid()) and role in ('admin', 'manager')
  ));

drop policy if exists "partners_read_pallet_profiles" on public.pallet_profiles;
create policy "partners_read_pallet_profiles"
  on public.pallet_profiles for select
  to authenticated
  using (exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'partner'
  ));

alter table public.products
  add column if not exists cartons_per_pallet_std numeric(8,2),
  add column if not exists cartons_per_pallet_hq numeric(8,2);
