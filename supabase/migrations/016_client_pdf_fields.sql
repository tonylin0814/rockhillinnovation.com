-- Extend client_invoices invoice_type to include 'commercial'
alter table public.client_invoices
  drop constraint if exists client_invoices_invoice_type_check;

alter table public.client_invoices
  add constraint client_invoices_invoice_type_check
  check (invoice_type in ('pro_forma', 'deposit', 'final', 'commercial'));

-- New fields on client_invoices
alter table public.client_invoices
  add column if not exists deposit_pct numeric not null default 50,
  add column if not exists payment_terms text,
  add column if not exists adjustment_lines jsonb not null default '[]'::jsonb;

-- New fields on client_quotation_sessions
alter table public.client_quotation_sessions
  add column if not exists quotation_ref text,
  add column if not exists valid_until date,
  add column if not exists pdf_onedrive_url text;
