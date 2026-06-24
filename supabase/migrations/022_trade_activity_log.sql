create table if not exists public.trade_activity_log (
  id           uuid primary key default gen_random_uuid(),
  trade_id     uuid references public.trades(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  user_name    text not null,
  user_role    text not null,
  action       text not null check (action in ('created', 'updated', 'deleted')),
  target_table text not null,
  target_id    uuid,
  summary      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists trade_activity_log_trade_id_idx on public.trade_activity_log(trade_id);
create index if not exists trade_activity_log_created_at_idx on public.trade_activity_log(created_at desc);

alter table public.trade_activity_log enable row level security;

drop policy if exists "managers_read_activity_log" on public.trade_activity_log;
create policy "managers_read_activity_log"
  on public.trade_activity_log
  for select
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('admin', 'manager')
    )
  );

drop policy if exists "service_insert_activity_log" on public.trade_activity_log;
create policy "service_insert_activity_log"
  on public.trade_activity_log
  for insert
  with check (true);
