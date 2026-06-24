drop policy if exists "user_read_granted_trades" on public.trades;
create policy "user_read_granted_trades"
  on public.trades for select
  using (
    exists (
      select 1 from public.user_client_access
      where user_id = (select auth.uid())
        and client_id = trades.client_id
    )
  );

drop policy if exists "user_edit_granted_trade_details" on public.trades;
create policy "user_edit_granted_trade_details"
  on public.trades for update
  using (
    exists (
      select 1 from public.user_client_access
      where user_id = (select auth.uid())
        and client_id = trades.client_id
        and access_level = 'edit'
    )
  )
  with check (
    exists (
      select 1 from public.user_client_access
      where user_id = (select auth.uid())
        and client_id = trades.client_id
        and access_level = 'edit'
    )
  );

drop policy if exists "user_read_products" on public.products;
create policy "user_read_products"
  on public.products for select
  using (
    exists (
      select 1 from public.users
      where id = (select auth.uid()) and role = 'user'
    )
  );

drop policy if exists "user_read_granted_quotation_history" on public.quotation_history;
create policy "user_read_granted_quotation_history"
  on public.quotation_history for select
  using (
    client_id is null
    or exists (
      select 1 from public.user_client_access
      where user_id = (select auth.uid())
        and client_id = quotation_history.client_id
    )
  );

drop policy if exists "user_read_granted_cost_history" on public.product_cost_history;
create policy "user_read_granted_cost_history"
  on public.product_cost_history for select
  using (
    client_id is null
    or exists (
      select 1 from public.user_client_access
      where user_id = (select auth.uid())
        and client_id = product_cost_history.client_id
    )
  );

drop policy if exists "user_read_granted_client_invoices" on public.client_invoices;
create policy "user_read_granted_client_invoices"
  on public.client_invoices for select
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = client_invoices.trade_id
        and uca.user_id = (select auth.uid())
    )
  );

drop policy if exists "user_read_granted_client_quotation_sessions" on public.client_quotation_sessions;
create policy "user_read_granted_client_quotation_sessions"
  on public.client_quotation_sessions for select
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = client_quotation_sessions.trade_id
        and uca.user_id = (select auth.uid())
    )
  );

drop policy if exists "user_edit_granted_client_quotation_sessions" on public.client_quotation_sessions;
create policy "user_edit_granted_client_quotation_sessions"
  on public.client_quotation_sessions for all
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = client_quotation_sessions.trade_id
        and uca.user_id = (select auth.uid())
        and uca.access_level = 'edit'
    )
  )
  with check (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = client_quotation_sessions.trade_id
        and uca.user_id = (select auth.uid())
        and uca.access_level = 'edit'
    )
  );

drop policy if exists "user_read_granted_client_quotation_lines" on public.client_quotation_lines;
create policy "user_read_granted_client_quotation_lines"
  on public.client_quotation_lines for select
  using (
    exists (
      select 1 from public.client_quotation_sessions cqs
      join public.trades t on t.id = cqs.trade_id
      join public.user_client_access uca on uca.client_id = t.client_id
      where cqs.id = client_quotation_lines.session_id
        and uca.user_id = (select auth.uid())
    )
  );

drop policy if exists "user_edit_granted_client_quotation_lines" on public.client_quotation_lines;
create policy "user_edit_granted_client_quotation_lines"
  on public.client_quotation_lines for all
  using (
    exists (
      select 1 from public.client_quotation_sessions cqs
      join public.trades t on t.id = cqs.trade_id
      join public.user_client_access uca on uca.client_id = t.client_id
      where cqs.id = client_quotation_lines.session_id
        and uca.user_id = (select auth.uid())
        and uca.access_level = 'edit'
    )
  )
  with check (
    exists (
      select 1 from public.client_quotation_sessions cqs
      join public.trades t on t.id = cqs.trade_id
      join public.user_client_access uca on uca.client_id = t.client_id
      where cqs.id = client_quotation_lines.session_id
        and uca.user_id = (select auth.uid())
        and uca.access_level = 'edit'
    )
  );

drop policy if exists "user_read_granted_order_lines" on public.order_lines;
create policy "user_read_granted_order_lines"
  on public.order_lines for select
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = order_lines.trade_id
        and uca.user_id = (select auth.uid())
    )
  );

drop policy if exists "user_read_granted_documents" on public.trade_documents;
create policy "user_read_granted_documents"
  on public.trade_documents for select
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = trade_documents.trade_id
        and uca.user_id = (select auth.uid())
    )
  );

drop policy if exists "user_read_granted_development_versions" on public.trade_development_versions;
create policy "user_read_granted_development_versions"
  on public.trade_development_versions for select
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = trade_development_versions.trade_id
        and uca.user_id = (select auth.uid())
    )
  );

drop policy if exists "user_edit_granted_development_versions" on public.trade_development_versions;
create policy "user_edit_granted_development_versions"
  on public.trade_development_versions for all
  using (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = trade_development_versions.trade_id
        and uca.user_id = (select auth.uid())
        and uca.access_level = 'edit'
    )
  )
  with check (
    exists (
      select 1 from public.trades t
      join public.user_client_access uca on uca.client_id = t.client_id
      where t.id = trade_development_versions.trade_id
        and uca.user_id = (select auth.uid())
        and uca.access_level = 'edit'
    )
  );
