-- Show the other party's profile picture in the chat header. Same pattern
-- as seller_name/buyer_name: the client can't read another user's
-- auth.users metadata directly (no profiles table, no admin access), so the
-- avatar URL is copied onto the row at post/creation time instead.
--
-- Run this once in the Supabase SQL editor.

alter table public.listings
  add column if not exists seller_avatar_url text;

alter table public.conversations
  add column if not exists buyer_avatar_url text;
