alter table public.trade_ledger
  add column if not exists expected_amount_usd numeric,
  add column if not exists proof_onedrive_url  text,
  add column if not exists proof_file_name     text;

create table if not exists public.trade_diary_entries (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades(id) on delete cascade,
  content     text not null,
  attachments jsonb not null default '[]'::jsonb,
  author_id   uuid references public.users(id) on delete set null,
  author_name text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trade_diary_entries_trade_created_idx
  on public.trade_diary_entries(trade_id, created_at desc);

alter table public.trade_diary_entries enable row level security;

drop policy if exists "managers_all_diary_entries" on public.trade_diary_entries;
create policy "managers_all_diary_entries"
  on public.trade_diary_entries for all
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

drop policy if exists "partner_read_diary_entries" on public.trade_diary_entries;
create policy "partner_read_diary_entries"
  on public.trade_diary_entries for select
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
