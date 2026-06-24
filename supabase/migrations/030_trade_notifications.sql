create table if not exists public.trade_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  trade_id    uuid not null references public.trades(id) on delete cascade,
  actor_id    uuid references public.users(id) on delete set null,
  actor_name  text not null,
  message     text not null,
  trade_code  text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists trade_notifications_user_read_created_idx
  on public.trade_notifications(user_id, is_read, created_at desc);
create index if not exists trade_notifications_trade_id_idx
  on public.trade_notifications(trade_id);

alter table public.trade_notifications enable row level security;

drop policy if exists "user_read_own_notifications" on public.trade_notifications;
create policy "user_read_own_notifications"
  on public.trade_notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_update_own_notifications" on public.trade_notifications;
create policy "user_update_own_notifications"
  on public.trade_notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.trade_notifications;
exception
  when duplicate_object then null;
end $$;
