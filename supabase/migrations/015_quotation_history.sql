create table if not exists public.quotation_history (
  id             uuid primary key default gen_random_uuid(),
  quote_date     date not null,
  trade_id       text,
  rock_hill_code text not null,
  product_name   text not null,
  quantity       numeric(12,4) not null default 1 check (quantity > 0),
  quoted_usd     numeric(12,4) not null check (quoted_usd >= 0),
  notes          text,
  created_at     timestamptz not null default now()
);

grant select, insert, update, delete on public.quotation_history to authenticated;
grant select, insert, update, delete on public.quotation_history to service_role;

alter table public.quotation_history enable row level security;

create policy "quotation_history_select" on public.quotation_history
  for select to authenticated
  using (true);

create policy "quotation_history_all" on public.quotation_history
  for all to authenticated
  using (true)
  with check (true);

create index if not exists quotation_history_quote_date_idx on public.quotation_history (quote_date desc, created_at desc);
create index if not exists quotation_history_code_idx on public.quotation_history (rock_hill_code);
