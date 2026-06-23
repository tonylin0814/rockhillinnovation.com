alter table public.products
  add column if not exists qty_per_carton numeric(12, 3),
  add column if not exists carton_height_cm numeric(12, 3),
  add column if not exists carton_width_cm numeric(12, 3),
  add column if not exists carton_length_cm numeric(12, 3),
  add column if not exists carton_weight_kg numeric(12, 3),
  add column if not exists cartons_per_pallet numeric(12, 3);

alter table public.product_cost_history
  add column if not exists moq text,
  add column if not exists quality text,
  add column if not exists carton_box_packaging text;
