alter table public.listings
  add column if not exists seller_phone_verified boolean not null default false;
