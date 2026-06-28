ALTER TABLE public.payout_invoices
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_file_id text,
  ADD COLUMN IF NOT EXISTS expense_vendor_id uuid REFERENCES public.expense_vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS lines jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS payout_invoices_vendor_idx ON public.payout_invoices(expense_vendor_id);
