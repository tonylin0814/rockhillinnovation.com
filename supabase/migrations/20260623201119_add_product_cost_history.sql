create table if not exists public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_product_code text,
  quoted_date date not null,
  unit_cost_rmb numeric(12, 4) not null check (unit_cost_rmb >= 0),
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.product_cost_history enable row level security;

create policy if not exists "product_cost_history_select_authenticated"
on public.product_cost_history
for select
to authenticated
using (true);

create index if not exists product_cost_history_product_date_idx
on public.product_cost_history (product_id, quoted_date desc, created_at desc);

create unique index if not exists product_cost_history_unique_source_idx
on public.product_cost_history (product_id, supplier_id, quoted_date, unit_cost_rmb, source)
where supplier_id is not null;
