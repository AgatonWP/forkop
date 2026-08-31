-- Sellers can't read a buyer's auth.users metadata directly (no profiles
-- table, no admin access), so the buyer's display name is copied onto the
-- conversation row at creation time instead — same pattern already used for
-- seller_name on listings. Run this once in the Supabase SQL editor.

alter table public.conversations
  add column if not exists buyer_name text;
