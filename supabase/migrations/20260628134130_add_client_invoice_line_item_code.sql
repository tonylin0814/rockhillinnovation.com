alter table public.client_invoice_lines
  add column if not exists item_code text;
