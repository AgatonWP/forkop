-- Wanted posts: "I'm looking for 2 förköp at Malmö on Saturday". A wanted post
-- is a listing like any other — same nation, ticket type, date, quantity, price
-- and trade fields — pointing the other way. Run this once in the Supabase SQL
-- editor.
--
-- The app is live with real listings on it, so every step below only ADDS.
-- Nothing an existing app version does, and no existing row, behaves any
-- differently after this runs:
--
--   * the new column defaults to 'offer', so every current listing — and every
--     listing an older app version posts from now on — is an offer, as before;
--   * wanted posts are hidden from app versions that do not know about them,
--     through a RESTRICTIVE policy that is true for every offer row, so it can
--     never take an offer out of anyone's feed;
--   * the Swish rule gains a second, additive policy for wanted posts; the
--     existing one is left exactly as it is;
--   * the watch trigger is re-declared with a WHEN clause so it skips wanted
--     posts; its function body is not touched.

-- ------------------------------------------------------------------ direction

alter table public.listings
  add column if not exists direction text not null default 'offer';

do $$
begin
  alter table public.listings
    add constraint listings_direction_check check (direction in ('offer', 'wanted'));
exception when duplicate_object then null;
end $$;

create index if not exists listings_direction_status_idx
  on public.listings (direction, status);

-- ----------------------------------------------------- which app is asking?
--
-- The app sends an x-forkop-api header with every request (see
-- src/lib/supabase.ts). An app version from before this migration sends
-- none, which reads as 1. Bump the number in the app whenever the database
-- learns something an older app would misread, and gate the new rows on it
-- the way wanted posts are gated below: that is what lets the schema move on
-- without breaking the version already on people's phones.
--
-- Anything unexpected — no header, a malformed one, a context with no HTTP
-- request at all — also reads as 1. Failing closed keeps new rows away from
-- old apps; it can never hide anything an old app could already see.
create or replace function public.client_api_version()
returns int
language plpgsql
stable
as $$
declare
  raw text;
begin
  raw := current_setting('request.headers', true)::json ->> 'x-forkop-api';
  if raw ~ '^[0-9]{1,4}$' then
    return raw::int;
  end if;
  return 1;
exception
  when others then
    return 1;
end;
$$;

grant execute on function public.client_api_version() to anon, authenticated;

-- An older app would render a wanted post as a ticket for sale. Restrictive
-- policies are AND-ed with the existing permissive ones, and this one is true
-- for every offer, so it can only ever remove wanted posts — never an offer.
drop policy if exists "Older app versions only see offers" on public.listings;
create policy "Older app versions only see offers"
  on public.listings
  as restrictive
  for select
  to anon, authenticated
  using (direction = 'offer' or (select public.client_api_version()) >= 2);

-- ---------------------------------------------------------------------- Swish
--
-- Swish is for the buyer, showing the seller's number. On an offer the buyer
-- is whoever got in touch, which the existing policy already covers. On a
-- wanted post it is the other way around: the post's owner is the buyer and
-- the person who replied is the seller. conversations.seller_id is always the
-- post owner and buyer_id always the person who got in touch — names that
-- predate wanted posts — so here the owner (seller_id) reads the replier's
-- (buyer_id) details.
--
-- Additive on purpose: permissive policies are OR-ed, so this grants access
-- for wanted posts without touching what buyers of offers can see today.
drop policy if exists "Wanted-post owners can read the replying seller's details" on public.seller_payment_details;
create policy "Wanted-post owners can read the replying seller's details"
  on public.seller_payment_details
  for select
  to authenticated
  using (
    not public.is_interaction_blocked(user_id)
    and exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where l.direction = 'wanted'
        and c.buyer_id = seller_payment_details.user_id
        and c.seller_id = (select auth.uid())
    )
  );

-- ------------------------------------------------------------------- watches
--
-- A watch means "tell me when tickets like these come up for sale". A wanted
-- post is the opposite of that, so it must not fire one. The trigger gets a
-- WHEN clause; notify_ticket_watchers() itself is left byte-for-byte as it was.
drop trigger if exists listings_notify_watchers on public.listings;
create trigger listings_notify_watchers
  after insert on public.listings
  for each row
  when (new.direction = 'offer')
  execute function public.notify_ticket_watchers();
