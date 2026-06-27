alter table public.trade_milestones
  alter column milestone type text;

alter table public.trade_diary_entries
  add column if not exists milestone_key text;

alter table public.trade_milestones
  add column if not exists completed_by text;

alter table public.trade_milestones
  drop constraint if exists trade_milestones_completed_by_fkey;

alter table public.trade_milestones
  alter column completed_by type text using completed_by::text;

delete from public.trade_milestones;
