-- Phone verification feature removed. Run this once in the Supabase SQL
-- editor to drop the now-unused column.

alter table public.listings
  drop column if exists seller_phone_verified;
