-- Add supplier invoice reference fields to outgoing records
ALTER TABLE supplier_invoices_outgoing
  ADD COLUMN IF NOT EXISTS supplier_invoice_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS supplier_stated_amount_rmb NUMERIC(12, 2);
