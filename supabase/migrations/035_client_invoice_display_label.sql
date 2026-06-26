-- Custom display label for final / additional invoices.
-- Examples: "Final Invoice", "2nd Invoice", "3rd Invoice".
alter table public.client_invoices
  add column if not exists display_label text;
