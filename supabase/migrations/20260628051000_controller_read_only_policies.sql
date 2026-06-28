do $$
declare
  table_name text;
  policy_name text;
  table_names text[] := array[
    'clients',
    'suppliers',
    'expense_vendors',
    'products',
    'product_components',
    'trades',
    'trade_participants',
    'supplier_quote_sessions',
    'supplier_quote_lines',
    'client_quotation_sessions',
    'client_quotation_lines',
    'client_invoices',
    'client_invoice_lines',
    'supplier_invoices_outgoing',
    'supplier_invoice_outgoing_lines',
    'supplier_invoice_adjustments',
    'vendor_invoices_outgoing',
    'vendor_invoice_outgoing_lines',
    'exchange_rates',
    'trade_documents',
    'trade_development_versions',
    'trade_development_costs',
    'trade_expenses',
    'trade_milestones',
    'trade_diary_entries',
    'trade_ledger',
    'shareholder_book',
    'shareholder_book_lines',
    'shareholder_payouts',
    'quotation_history',
    'product_cost_history',
    'trade_packing_plans',
    'trade_packing_pallets',
    'trade_packing_cases',
    'pallet_profiles'
  ];
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      for policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and (
            policyname like 'admin_manager_all_%'
            or policyname like 'managers_all_%'
            or policyname like 'admin_all_%'
            or policyname like 'manager_read_%'
            or policyname like 'manager_controller_read_%'
          )
      loop
        execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      end loop;

      execute format('drop policy if exists %I on public.%I', 'admin_manager_all_' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'managers_all_' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'admin_all_' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'manager_read_' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'controller_read_' || table_name, table_name);

      execute format(
        'create policy %I on public.%I for all using (public.get_my_role() = ''admin'') with check (public.get_my_role() = ''admin'')',
        'admin_all_' || table_name,
        table_name
      );
      execute format(
        'create policy %I on public.%I for select using (public.get_my_role() in (''manager'', ''controller''))',
        'manager_controller_read_' || table_name,
        table_name
      );
    end if;
  end loop;
end $$;

drop policy if exists "manager_read_users" on public.users;
drop policy if exists "controller_read_users" on public.users;
drop policy if exists "manager_controller_read_users" on public.users;
create policy "manager_controller_read_users"
  on public.users
  for select
  using (public.get_my_role() in ('manager', 'controller'));

drop policy if exists "company_settings_read_for_admins_managers" on public.company_settings;
create policy "company_settings_read_for_admins_managers"
  on public.company_settings
  for select
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role in ('admin', 'manager', 'controller')
    )
  );

drop policy if exists "company_banking_read_for_admins_managers" on public.company_banking_accounts;
create policy "company_banking_read_for_admins_managers"
  on public.company_banking_accounts
  for select
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid())
        and role in ('admin', 'manager', 'controller')
    )
  );
