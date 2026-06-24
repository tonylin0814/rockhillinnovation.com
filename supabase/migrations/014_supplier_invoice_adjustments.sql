create table if not exists public.supplier_invoice_adjustments (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.supplier_invoices_outgoing(id) on delete cascade,
  description    text not null,
  amount_rmb     numeric(12,2) not null check (amount_rmb > 0),
  notes          text,
  created_at     timestamptz not null default now()
);

alter table public.supplier_invoice_adjustments enable row level security;

create policy "adj_select" on public.supplier_invoice_adjustments
  for select to authenticated
  using (true);

create policy "adj_all" on public.supplier_invoice_adjustments
  for all to authenticated
  using (true)
  with check (true);
