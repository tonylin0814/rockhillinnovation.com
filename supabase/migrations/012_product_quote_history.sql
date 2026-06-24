create table if not exists public.product_quote_history (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid references public.products(id) on delete cascade,
  client_id             uuid references public.clients(id) on delete set null,
  supplier_product_code text,
  quoted_date           date not null,
  unit_price_usd        numeric(12, 4) not null check (unit_price_usd >= 0),
  quantity              numeric(12, 4),
  source                text not null default 'manual',
  notes                 text,
  created_at            timestamptz not null default now()
);

alter table public.product_quote_history enable row level security;

create policy if not exists "product_quote_history_select_authenticated"
  on public.product_quote_history for select to authenticated using (true);

create index if not exists product_quote_history_product_date_idx
  on public.product_quote_history (product_id, quoted_date desc, created_at desc);
