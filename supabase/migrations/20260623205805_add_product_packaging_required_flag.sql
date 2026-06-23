alter table public.products
  add column if not exists packaging_required boolean not null default false;
