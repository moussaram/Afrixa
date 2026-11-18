alter table public.orders
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision;

alter table public.orders
  add constraint orders_delivery_coordinates_pair_check
  check ((delivery_lat is null) = (delivery_lng is null)) not valid;

alter table public.orders
  validate constraint orders_delivery_coordinates_pair_check;
