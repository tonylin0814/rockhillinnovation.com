-- Tighten audit findings around broad authenticated/partner access.

drop policy if exists "partner_read_supplier_quote_lines" on public.supplier_quote_lines;
create policy "partner_read_supplier_quote_lines"
  on public.supplier_quote_lines for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and exists (
      select 1
      from public.supplier_quote_sessions sqs
      where sqs.id = supplier_quote_lines.session_id
        and sqs.trade_id in (select public.my_trade_ids())
    )
  );

drop policy if exists "partner_read_client_quotation_lines" on public.client_quotation_lines;
create policy "partner_read_client_quotation_lines"
  on public.client_quotation_lines for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and exists (
      select 1
      from public.client_quotation_sessions cqs
      where cqs.id = client_quotation_lines.session_id
        and cqs.trade_id in (select public.my_trade_ids())
    )
  );

drop policy if exists "partner_read_client_invoice_lines" on public.client_invoice_lines;
create policy "partner_read_client_invoice_lines"
  on public.client_invoice_lines for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and exists (
      select 1
      from public.client_invoices ci
      where ci.id = client_invoice_lines.invoice_id
        and ci.trade_id in (select public.my_trade_ids())
    )
  );

drop policy if exists "partner_read_supplier_invoice_outgoing_lines" on public.supplier_invoice_outgoing_lines;
create policy "partner_read_supplier_invoice_outgoing_lines"
  on public.supplier_invoice_outgoing_lines for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and exists (
      select 1
      from public.supplier_invoices_outgoing sio
      where sio.id = supplier_invoice_outgoing_lines.invoice_id
        and sio.trade_id in (select public.my_trade_ids())
    )
  );

drop policy if exists "partner_read_shareholder_book_lines" on public.shareholder_book_lines;
create policy "partner_read_shareholder_book_lines"
  on public.shareholder_book_lines for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and exists (
      select 1
      from public.shareholder_book sb
      where sb.id = shareholder_book_lines.book_id
        and sb.trade_id in (select public.my_trade_ids())
    )
  );

drop policy if exists "product_cost_history_select_authenticated" on public.product_cost_history;
drop policy if exists "admin_manager_all_product_cost_history" on public.product_cost_history;
drop policy if exists "user_read_granted_cost_history" on public.product_cost_history;
alter table public.product_cost_history
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists product_cost_history_client_idx on public.product_cost_history(client_id);
create policy "admin_manager_all_product_cost_history"
  on public.product_cost_history for all
  to authenticated
  using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));
create policy "user_read_granted_cost_history"
  on public.product_cost_history for select
  to authenticated
  using (
    public.get_my_role() = 'user'
    and (
      client_id is null
      or exists (
        select 1
        from public.user_client_access
        where user_id = (select auth.uid())
          and client_id = product_cost_history.client_id
      )
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

drop policy if exists "authenticated_read_ai_configs" on public.ai_configs;
drop policy if exists "admin_all_ai_configs" on public.ai_configs;
create policy "admin_all_ai_configs"
  on public.ai_configs for all
  to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

drop policy if exists "service_insert_activity_log" on public.trade_activity_log;
create policy "service_insert_activity_log"
  on public.trade_activity_log for insert
  to service_role
  with check (true);
