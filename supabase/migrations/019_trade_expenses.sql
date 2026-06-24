create table public.trade_expenses (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  description text not null,
  amount_usd numeric not null,
  expense_date date not null,
  category text not null default 'misc'
    check (category in ('bank_fee', 'reimbursement', 'shipping', 'duty', 'misc')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.trade_expenses(trade_id);

create trigger trade_expenses_updated_at
  before update on public.trade_expenses
  for each row execute function set_updated_at();

alter table public.trade_expenses enable row level security;

create policy "managers_all_trade_expenses"
  on public.trade_expenses
  for all
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role in ('admin', 'manager')
    )
  );

create policy "partners_read_trade_expenses"
  on public.trade_expenses
  for select
  using (
    trade_id in (
      select trade_id from public.trade_participants
      where user_id = (select auth.uid())
    )
  );
