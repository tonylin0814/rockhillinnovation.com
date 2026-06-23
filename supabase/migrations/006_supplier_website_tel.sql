alter table public.suppliers
add column if not exists website text,
add column if not exists tel text;
