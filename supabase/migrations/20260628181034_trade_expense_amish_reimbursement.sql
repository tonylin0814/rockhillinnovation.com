alter table public.trade_expenses
  drop constraint if exists trade_expenses_category_check;

alter table public.trade_expenses
  add constraint trade_expenses_category_check
  check (category in ('bank_fee', 'reimbursement_tony', 'reimbursement_michael', 'reimbursement_amish', 'shipping', 'duty', 'misc'));
