alter table public.suppliers
add column if not exists bank_currency text,
add column if not exists bank_institution_no text,
add column if not exists bank_transit_no text,
add column if not exists bank_tel text,
add column if not exists banking_instructions text;
