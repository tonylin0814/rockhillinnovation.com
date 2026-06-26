-- Allow 'commercial' as a supplier invoice type.
alter table public.supplier_invoices_outgoing
  drop constraint if exists supplier_invoices_outgoing_invoice_type_check;

alter table public.supplier_invoices_outgoing
  add constraint supplier_invoices_outgoing_invoice_type_check
  check (invoice_type in ('deposit', 'final', 'commercial'));
