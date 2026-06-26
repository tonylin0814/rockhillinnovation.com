-- Banking fields on expense_vendors for outgoing vendor invoice PDF output.
alter table public.expense_vendors
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_name text,
  add column if not exists bank_address text,
  add column if not exists bank_swift_code text,
  add column if not exists bank_aba_routing text,
  add column if not exists bank_currency text,
  add column if not exists banking_instructions text;

-- Multiple line items on vendor invoices. amount_usd remains the invoice total.
alter table public.expense_vendor_invoices
  add column if not exists lines jsonb;
