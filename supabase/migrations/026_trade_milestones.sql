create table if not exists public.trade_milestones (
  trade_id     uuid not null references public.trades(id) on delete cascade,
  milestone    text not null check (milestone in (
                 'deposit_received',
                 'deposit_sent',
                 'goods_shipped',
                 'balance_received',
                 'balance_sent'
               )),
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  notes        text,
  primary key (trade_id, milestone)
);

create index if not exists trade_milestones_trade_id_idx on public.trade_milestones(trade_id);

alter table public.trade_milestones enable row level security;

drop policy if exists "managers_all_trade_milestones" on public.trade_milestones;
create policy "managers_all_trade_milestones"
  on public.trade_milestones for all
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('admin', 'manager')
    )
  );

drop policy if exists "partner_read_trade_milestones" on public.trade_milestones;
create policy "partner_read_trade_milestones"
  on public.trade_milestones for select
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid()) and role = 'partner'
    )
    and trade_id in (
      select trade_id from public.trade_participants
      where user_id = (select auth.uid())
    )
  );
