-- Room to work for the accounts we vouch for. Run this once in the Supabase
-- SQL editor, after 20260925090000_official_accounts.sql.
--
-- The limits were written for a student with a couple of spare tickets. An
-- official account — LTH Griparna with forty förköp after a match — answers a
-- hundred people in an evening, and the daily cap of 300 messages would cut
-- them off mid-conversation, looking for all the world like a broken app.
--
-- The new ceilings are not "no limit". They are set where no person can reach
-- them but a stolen account or a runaway loop still stops before it has
-- spammed all of Lund: thirty messages in ten seconds is faster than anyone
-- types, and three thousand a day is ten times a full evening of replying.
-- Keeping them there costs the accounts nothing and keeps the brake.
--
-- Also fixes an oversight: the allowance of 100 active listings was written
-- for verified_organizers, and official accounts never got it.

create or replace function public.is_trusted_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.official_accounts o where o.user_id = p_user_id)
      or exists (select 1 from public.verified_organizers v where v.user_id = p_user_id);
$$;

revoke all on function public.is_trusted_account(uuid) from public, anon, authenticated;

-- --------------------------------------------------------------- messages

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trusted boolean := public.is_trusted_account(new.sender_id);
  count_10s int;
  count_60s int;
  count_24h int;
begin
  select count(*) into count_10s from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '10 seconds';
  if count_10s >= (case when trusted then 30 else 5 end) then
    raise exception 'Du skickar meddelanden för snabbt. Vänta några sekunder och försök igen.';
  end if;

  -- The per-minute cap is for someone pasting the same message to everyone.
  -- An official account answering its buyers is exactly that pattern, and
  -- wanted, so they skip it.
  if not trusted then
    select count(*) into count_60s from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute';
    if count_60s >= 20 then
      raise exception 'Du har skickat för många meddelanden den senaste minuten. Vänta lite och försök igen.';
    end if;
  end if;

  select count(*) into count_24h from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '24 hours';
  if count_24h >= (case when trusted then 3000 else 300 end) then
    raise exception 'Du har nått dagens gräns för antal meddelanden. Försök igen imorgon.';
  end if;

  return new;
end;
$$;

-- --------------------------------------------------------------- listings

create or replace function public.enforce_listing_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trusted boolean := public.is_trusted_account(new.user_id);
  recent_count int;
  active_count int;
  active_allowance int := case when trusted then 100 else 30 end;
begin
  select count(*) into recent_count
  from public.listings
  where user_id = new.user_id and created_at > now() - interval '10 minutes';

  if recent_count >= (case when trusted then 30 else 5 end) then
    raise exception 'Du lägger upp annonser för snabbt.' using errcode = '23W02';
  end if;

  select count(*) into active_count
  from public.listings
  where user_id = new.user_id and status = 'active';

  if active_count >= active_allowance then
    raise exception 'Du har för många aktiva annonser.' using errcode = '23W03';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------- conversations

create or replace function public.enforce_conversation_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.conversations
  where buyer_id = new.buyer_id and created_at > now() - interval '1 hour';

  if recent_count >= (case when public.is_trusted_account(new.buyer_id) then 100 else 20 end) then
    raise exception 'Du har startat många chattar den senaste timmen.' using errcode = '23W05';
  end if;

  return new;
end;
$$;

-- Reports keep their ten a day for everyone: an official account has no more
-- reason to report than anyone else, and that cap protects the moderation
-- queue rather than the accounts.
