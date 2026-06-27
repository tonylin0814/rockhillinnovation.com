alter table public.trade_shareholders
  add column if not exists user_id uuid references public.users(id) on delete set null;
