alter table public.products
  add column if not exists pallet_diagram jsonb;
