alter table public.products
add column if not exists supplier_product_code text;

create unique index if not exists products_code_unique_idx
on public.products (upper(code));

create index if not exists products_supplier_product_code_idx
on public.products (supplier_id, supplier_product_code)
where supplier_product_code is not null;
