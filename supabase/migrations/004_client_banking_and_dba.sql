alter table public.clients
add column if not exists dba_name text,
add column if not exists bank_name text,
add column if not exists bank_branch text,
add column if not exists bank_account_name text,
add column if not exists bank_account_number text,
add column if not exists bank_swift_code text,
add column if not exists bank_address text,
add column if not exists bank_tel text;
