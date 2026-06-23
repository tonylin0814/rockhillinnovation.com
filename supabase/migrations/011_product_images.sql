alter table public.products
add column if not exists product_images jsonb not null default '[]'::jsonb;
