grant select, insert, update, delete on public.trade_development_versions to authenticated, service_role;
grant select, insert, update, delete on public.trade_development_costs to authenticated, service_role;
grant select, insert, update, delete on public.supplier_invoice_adjustments to authenticated, service_role;
grant select, insert, update, delete on public.quotation_history to authenticated, service_role;
grant select, insert, update, delete on public.product_cost_history to authenticated, service_role;
grant select, update on public.trade_notifications to authenticated;
grant select, insert, update, delete on public.trade_notifications to service_role;

alter function public.get_my_role() set search_path = public;
alter function public.my_trade_ids() set search_path = public;

drop policy if exists "dev_versions_select" on public.trade_development_versions;
drop policy if exists "dev_versions_all" on public.trade_development_versions;
drop policy if exists "dev_costs_select" on public.trade_development_costs;
drop policy if exists "dev_costs_all" on public.trade_development_costs;
drop policy if exists "admin_manager_all_dev_versions" on public.trade_development_versions;
drop policy if exists "partner_select_dev_versions" on public.trade_development_versions;
drop policy if exists "admin_manager_all_dev_costs" on public.trade_development_costs;
drop policy if exists "partner_select_dev_costs" on public.trade_development_costs;

create policy "admin_manager_all_dev_versions"
  on public.trade_development_versions for all
  to authenticated
  using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

create policy "partner_select_dev_versions"
  on public.trade_development_versions for select
  to authenticated
  using (public.get_my_role() = 'partner' and trade_id in (select public.my_trade_ids()));

create policy "admin_manager_all_dev_costs"
  on public.trade_development_costs for all
  to authenticated
  using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

create policy "partner_select_dev_costs"
  on public.trade_development_costs for select
  to authenticated
  using (public.get_my_role() = 'partner' and trade_id in (select public.my_trade_ids()));

drop policy if exists "adj_select" on public.supplier_invoice_adjustments;
drop policy if exists "adj_all" on public.supplier_invoice_adjustments;
drop policy if exists "admin_manager_all_supplier_invoice_adjustments" on public.supplier_invoice_adjustments;
drop policy if exists "partner_select_supplier_invoice_adjustments" on public.supplier_invoice_adjustments;

create policy "admin_manager_all_supplier_invoice_adjustments"
  on public.supplier_invoice_adjustments for all
  to authenticated
  using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

create policy "partner_select_supplier_invoice_adjustments"
  on public.supplier_invoice_adjustments for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and exists (
      select 1
      from public.supplier_invoices_outgoing sio
      where sio.id = supplier_invoice_adjustments.invoice_id
        and sio.trade_id in (select public.my_trade_ids())
    )
  );

drop policy if exists "quotation_history_select" on public.quotation_history;
drop policy if exists "quotation_history_all" on public.quotation_history;
drop policy if exists "admin_manager_all_quotation_history" on public.quotation_history;

create policy "admin_manager_all_quotation_history"
  on public.quotation_history for all
  to authenticated
  using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

drop policy if exists "product_cost_history_select_authenticated" on public.product_cost_history;
drop policy if exists "admin_manager_all_product_cost_history" on public.product_cost_history;

create policy "admin_manager_all_product_cost_history"
  on public.product_cost_history for all
  to authenticated
  using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));
