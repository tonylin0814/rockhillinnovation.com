alter table public.products
  add column if not exists has_carton boolean not null default false;
