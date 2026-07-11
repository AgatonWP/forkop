-- Show the poster's name on a listing. Client code can't read another
-- user's auth.users metadata (no profiles table, no admin access), so
-- the display name is copied onto the listing row at post time instead.
--
-- Run this once in the Supabase SQL editor.

alter table public.listings
  add column if not exists seller_name text;
