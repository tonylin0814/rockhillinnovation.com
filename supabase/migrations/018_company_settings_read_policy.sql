-- Allow admins and managers to READ company settings and banking accounts.
-- Write operations remain admin-only (covered by the existing policies).

drop policy if exists "authenticated_read_company_settings" on public.company_settings;
create policy "authenticated_read_company_settings"
  on public.company_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role in ('admin', 'manager')
    )
  );

drop policy if exists "authenticated_read_company_banking" on public.company_banking_accounts;
create policy "authenticated_read_company_banking"
  on public.company_banking_accounts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role in ('admin', 'manager')
    )
  );
