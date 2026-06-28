alter table public.trade_milestones
  drop constraint if exists trade_milestones_milestone_check;

alter table public.trade_milestones
  add constraint trade_milestones_milestone_check
  check (milestone in (
    'dev_sample_design',
    'dev_sample_shipping',
    'dev_first_estimate',
    'dev_product_accepted',
    'inquiry_received',
    'quote_received',
    'quotation_sent',
    'deposit_invoice_sent',
    'deposit_received',
    'deposit_sent',
    'production_ongoing',
    'packing_strategy',
    'final_invoice_sent',
    'final_payment_received',
    'qc_arrangement',
    'qc_complete',
    'freight_arrangement',
    'final_supplier_invoice',
    'freight_starts',
    'vendor_payment',
    'client_received',
    'feedback',
    'accounting'
  ));

alter table public.trade_diary_entries
  drop constraint if exists trade_diary_entries_milestone_key_check;

alter table public.trade_diary_entries
  add constraint trade_diary_entries_milestone_key_check
  check (
    milestone_key is null
    or milestone_key in (
      'dev_sample_design',
      'dev_sample_shipping',
      'dev_first_estimate',
      'dev_product_accepted',
      'inquiry_received',
      'quote_received',
      'quotation_sent',
      'deposit_invoice_sent',
      'deposit_received',
      'deposit_sent',
      'production_ongoing',
      'packing_strategy',
      'final_invoice_sent',
      'final_payment_received',
      'qc_arrangement',
      'qc_complete',
      'freight_arrangement',
      'final_supplier_invoice',
      'freight_starts',
      'vendor_payment',
      'client_received',
      'feedback',
      'accounting'
    )
  );
