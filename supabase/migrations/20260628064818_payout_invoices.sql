CREATE TABLE IF NOT EXISTS public.payout_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  trade_shareholder_id uuid REFERENCES public.trade_shareholders(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  dividend_usd numeric(12,2) NOT NULL,
  invoice_url text,
  invoice_filename text,
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'paid')),
  status_changed_at timestamptz,
  status_changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  generated_at timestamptz,
  generated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payout_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_invoices_select_staff"
  ON public.payout_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'controller', 'manager')
        AND users.is_active = true
    )
  );

CREATE POLICY "payout_invoices_write_finance"
  ON public.payout_invoices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'controller')
        AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'controller')
        AND users.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS payout_invoices_trade_idx ON public.payout_invoices(trade_id);
CREATE UNIQUE INDEX IF NOT EXISTS payout_invoices_unique_shareholder
  ON public.payout_invoices(trade_id, trade_shareholder_id)
  WHERE trade_shareholder_id IS NOT NULL;
