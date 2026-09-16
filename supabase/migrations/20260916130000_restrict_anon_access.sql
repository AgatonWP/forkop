-- Signed-out visitors need exactly two things from the database: the active
-- listings and the verified-organizer badges. Everything else answered them
-- with an empty result rather than an error, which means the privilege was
-- there and only row level security stood in the way. Take the privilege away
-- too, so a future policy mistake can't turn into a data leak.
--
-- Nothing in the app reads these tables while signed out (ratings are fetched
-- on a listing card, but that call already ignores failures), so this is not
-- visible to users. Run once in the Supabase SQL editor.
do $$
declare
  target text;
begin
  foreach target in array array[
    'conversations',
    'messages',
    'reports',
    'ratings',
    'push_tokens',
    'seller_payment_details',
    'blocked_users',
    'admins',
    'ticket_watches',
    'profiles'
  ]
  loop
    if to_regclass('public.' || target) is not null then
      execute format('revoke all on public.%I from anon', target);
    end if;
  end loop;
end $$;

-- Left readable on purpose:
--   listings             – the feed works signed out
--   verified_organizers  – the badge has to render for everyone
