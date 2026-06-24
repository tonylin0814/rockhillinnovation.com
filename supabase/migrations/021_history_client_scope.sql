alter table public.quotation_history
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists quotation_history_client_idx on public.quotation_history(client_id);

do $$
begin
  if to_regclass('public.product_cost_history') is not null then
    alter table public.product_cost_history
      add column if not exists client_id uuid references public.clients(id) on delete set null;
    create index if not exists product_cost_history_client_idx on public.product_cost_history(client_id);
  end if;
end $$;
