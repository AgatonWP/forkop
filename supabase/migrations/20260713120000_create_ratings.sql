-- Ratings: after marking a listing sold, the seller picks which buyer they
-- sold to and rates them (1-5). Publicly readable (to signed-in users) so
-- anyone can see a user's track record before transacting with them; only
-- the seller of the listing can write one, and only for a real buyer from
-- that listing's conversations (conversations.seller_id is itself
-- trigger-derived from the listing owner, so this can't be spoofed from
-- the client). Run this once in the Supabase SQL editor.

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  rater_id uuid not null references auth.users (id) on delete cascade,
  rated_user_id uuid not null references auth.users (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (listing_id)
);

create index if not exists ratings_rated_user_id_idx on public.ratings (rated_user_id);

alter table public.ratings enable row level security;

drop policy if exists "Ratings are readable by signed-in users" on public.ratings;
create policy "Ratings are readable by signed-in users"
  on public.ratings
  for select
  to authenticated
  using (true);

drop policy if exists "Sellers can rate their real buyers" on public.ratings;
create policy "Sellers can rate their real buyers"
  on public.ratings
  for insert
  to authenticated
  with check (
    auth.uid() = rater_id
    and exists (
      select 1 from public.conversations c
      where c.listing_id = ratings.listing_id
        and c.buyer_id = ratings.rated_user_id
        and c.seller_id = auth.uid()
    )
  );
