alter table public.clients
  add column if not exists bank_institution_no text,
  add column if not exists bank_transit_no text;

alter table public.expense_vendors
  add column if not exists bank_institution_no text,
  add column if not exists bank_transit_no text,
  add column if not exists bank_tel text;
