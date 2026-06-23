alter table public.suppliers
  drop constraint if exists suppliers_invoice_format_check;

alter table public.suppliers
  add constraint suppliers_invoice_format_check
  check (invoice_format in ('image', 'excel', 'pdf', 'word'));
