alter table public.supplier_quote_lines
  add column if not exists previous_unit_cost_rmb numeric,
  add column if not exists cost_change_rmb numeric
    generated always as (
      case
        when previous_unit_cost_rmb is null then null
        else unit_price_rmb - previous_unit_cost_rmb
      end
    ) stored,
  add column if not exists cost_change_pct numeric
    generated always as (
      case
        when previous_unit_cost_rmb is null or previous_unit_cost_rmb = 0 then null
        else ((unit_price_rmb - previous_unit_cost_rmb) / previous_unit_cost_rmb) * 100
      end
    ) stored;
