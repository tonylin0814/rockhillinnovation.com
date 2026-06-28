alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'controller', 'manager', 'partner', 'user'));

update public.users
set role = 'controller'
where lower(name) = 'kimi'
   or lower(email) = 'molibox@hotmail.com';
