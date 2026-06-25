alter table public.products
  add column if not exists product_length_cm numeric(8,2),
  add column if not exists product_width_cm numeric(8,2),
  add column if not exists product_height_cm numeric(8,2),
  add column if not exists product_weight_kg numeric(8,3),
  add column if not exists product_art_notes text;
