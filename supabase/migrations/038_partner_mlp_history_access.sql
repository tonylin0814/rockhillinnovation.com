drop policy if exists "partner_read_clients" on public.clients;
drop policy if exists "partner_read_suppliers" on public.suppliers;
drop policy if exists "partner_read_expense_vendors" on public.expense_vendors;
drop policy if exists "partner_read_products" on public.products;
drop policy if exists "partner_read_product_components" on public.product_components;

create policy "partner_read_mlp_products"
  on public.products for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and code ilike 'MLP-%'
  );

create policy "partner_read_mlp_product_components"
  on public.product_components for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and (
      exists (
        select 1
        from public.products p
        where p.id = product_components.set_product_id
          and p.code ilike 'MLP-%'
      )
      or exists (
        select 1
        from public.products p
        where p.id = product_components.component_product_id
          and p.code ilike 'MLP-%'
      )
    )
  );

drop policy if exists "partner_read_mlp_quotation_history" on public.quotation_history;
create policy "partner_read_mlp_quotation_history"
  on public.quotation_history for select
  to authenticated
  using (
    public.get_my_role() = 'partner'
    and rock_hill_code ilike 'MLP-%'
  );

do $$
begin
  if to_regclass('public.product_cost_history') is not null then
    drop policy if exists "partner_read_mlp_product_cost_history" on public.product_cost_history;
    create policy "partner_read_mlp_product_cost_history"
      on public.product_cost_history for select
      to authenticated
      using (
        public.get_my_role() = 'partner'
        and exists (
          select 1
          from public.products p
          where p.id = product_cost_history.product_id
            and p.code ilike 'MLP-%'
        )
      );
  end if;
end $$;
