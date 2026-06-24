create table if not exists public.trade_development_versions (
  id                   uuid primary key default gen_random_uuid(),
  trade_id             uuid not null references public.trades(id) on delete cascade,
  product_id           uuid references public.products(id) on delete set null,
  product_name_override text,
  version_label        varchar(20) not null,
  change_summary       text,
  file_onedrive_url    text,
  status               varchar(30) not null default 'draft'
                         check (status in ('draft','sent_to_producer','sample_received','client_approved','rejected','in_correction')),
  notes                text,
  created_at           timestamptz not null default now()
);

create table if not exists public.trade_development_costs (
  id           uuid primary key default gen_random_uuid(),
  trade_id     uuid not null references public.trades(id) on delete cascade,
  version_id   uuid references public.trade_development_versions(id) on delete set null,
  cost_type    varchar(30) not null
                 check (cost_type in ('molding','sample','express_shipping','other')),
  description  text,
  amount_rmb   numeric(12,2),
  amount_cad   numeric(12,2),
  amount_usd   numeric(12,2),
  is_absorbed  boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.trade_development_versions enable row level security;
alter table public.trade_development_costs enable row level security;

create policy "dev_versions_select" on public.trade_development_versions for select to authenticated using (true);
create policy "dev_versions_all"    on public.trade_development_versions for all    to authenticated using (true) with check (true);
create policy "dev_costs_select"    on public.trade_development_costs    for select to authenticated using (true);
create policy "dev_costs_all"       on public.trade_development_costs    for all    to authenticated using (true) with check (true);

create index if not exists dev_versions_trade_idx on public.trade_development_versions (trade_id, created_at desc);
create index if not exists dev_costs_trade_idx    on public.trade_development_costs    (trade_id, created_at desc);

alter table public.supplier_quote_sessions
  add column if not exists source_document_url text;
