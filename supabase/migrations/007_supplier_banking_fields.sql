alter table public.suppliers
add column if not exists bank_account_name text,
add column if not exists bank_account_number text,
add column if not exists bank_name text,
add column if not exists bank_address text,
add column if not exists bank_cnaps_no text,
add column if not exists bank_swift_code text;
