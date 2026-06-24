alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'manager', 'partner', 'user'));

create table if not exists public.user_client_access (
  user_id       uuid not null references public.users(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  access_level  text not null default 'read'
    check (access_level in ('read', 'edit')),
  granted_at    timestamptz not null default now(),
  granted_by    uuid references public.users(id) on delete set null,
  primary key (user_id, client_id)
);

create index if not exists user_client_access_user_id_idx on public.user_client_access(user_id);
create index if not exists user_client_access_client_id_idx on public.user_client_access(client_id);

alter table public.user_client_access enable row level security;

drop policy if exists "admin_all_user_client_access" on public.user_client_access;
create policy "admin_all_user_client_access"
  on public.user_client_access
  for all
  using (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "user_read_own_grants" on public.user_client_access;
create policy "user_read_own_grants"
  on public.user_client_access
  for select
  using (user_id = (select auth.uid()));
