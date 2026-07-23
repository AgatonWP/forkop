-- Denormalized copy of the poster's "Verifierad student" status, mirroring
-- seller_name (see 20260713090000_add_listing_seller_name.sql) for the same
-- reason: client code can't read another user's auth.users metadata.
--
-- Run this once in the Supabase SQL editor.

alter table public.listings
  add column if not exists seller_verified boolean not null default false;
