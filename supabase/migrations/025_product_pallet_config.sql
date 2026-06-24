alter table public.products
  add column if not exists pallet_length_cm numeric(8,2),
  add column if not exists pallet_width_cm numeric(8,2),
  add column if not exists pallet_height_cm numeric(8,2),
  add column if not exists pallet_max_weight_kg numeric(8,2),
  add column if not exists country_of_origin text not null default 'CHINA';
