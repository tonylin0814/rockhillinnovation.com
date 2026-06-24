create table if not exists public.shareholder_payouts (
  id                   uuid primary key default gen_random_uuid(),
  trade_id             uuid not null references public.trades(id) on delete cascade,
  trade_shareholder_id uuid references public.trade_shareholders(id) on delete set null,
  person_name          text not null,
  amount_usd           numeric not null,
  wire_date            date not null,
  reference            text,
  notes                text,
  created_by           uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists shareholder_payouts_trade_id_idx on public.shareholder_payouts(trade_id);
create index if not exists shareholder_payouts_wire_date_idx on public.shareholder_payouts(wire_date desc);

alter table public.shareholder_payouts enable row level security;

drop policy if exists "admin_all_shareholder_payouts" on public.shareholder_payouts;
create policy "admin_all_shareholder_payouts"
  on public.shareholder_payouts for all
  using (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "manager_read_shareholder_payouts" on public.shareholder_payouts;
create policy "manager_read_shareholder_payouts"
  on public.shareholder_payouts for select
  using (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'manager')
  );
