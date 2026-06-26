alter table public.company_settings
  add column if not exists invoice_bcc_email text;
