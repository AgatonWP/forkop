-- Ticket watches: a user saves a filter combination ("Malmö Nation,
-- Förköp, 12 sep") and gets a push notification the moment a matching
-- listing is posted. Run this once in the Supabase SQL editor (there is no
-- linked Supabase CLI project in this repo, so it isn't applied
-- automatically).
--
-- The free-text search box is deliberately not part of a watch: it matches
-- loosely on event name and nation aliases, so "what will notify me" would
-- stop being predictable. A watch therefore needs at least an organizer or
-- a ticket type, and narrows from there with deal type and dates.
create extension if not exists pg_net with schema extensions;

create table if not exists public.ticket_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nation_id text,
  ticket_type text,
  deal_type text check (deal_type in ('sell', 'trade')),
  event_dates date[],
  created_at timestamptz not null default now(),
  -- A watch on nothing but a date or a deal type would fire on nearly every
  -- listing, which is how notification settings get switched off for good.
  constraint ticket_watches_needs_subject
    check (nation_id is not null or ticket_type is not null),
  constraint ticket_watches_dates_sane
    check (event_dates is null or array_length(event_dates, 1) between 1 and 60)
);

create index if not exists ticket_watches_user_id_idx on public.ticket_watches (user_id);
create index if not exists ticket_watches_nation_id_idx on public.ticket_watches (nation_id);

-- Two identical watches would only mean two identical notifications. The
-- coalesce()s are what make NULL (= "any") compare equal across rows.
create unique index if not exists ticket_watches_unique_idx
  on public.ticket_watches (
    user_id,
    coalesce(nation_id, ''),
    coalesce(ticket_type, ''),
    coalesce(deal_type, ''),
    coalesce(event_dates, '{}'::date[])
  );

alter table public.ticket_watches enable row level security;
revoke all on public.ticket_watches from anon;
grant select, insert, delete on public.ticket_watches to authenticated;

drop policy if exists "Users can manage their own watches" on public.ticket_watches;
create policy "Users can manage their own watches"
  on public.ticket_watches
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A cap keeps one account from turning every new listing into a fan-out of
-- push requests. 23W01 is ours, so the app can tell this apart from a generic
-- failure and say which limit was hit. Not a "PT..." code: PostgREST reads
-- those as the HTTP status to return.
create or replace function public.enforce_ticket_watch_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.ticket_watches where user_id = new.user_id) >= 20 then
    raise exception 'ticket watch limit reached' using errcode = '23W01';
  end if;

  return new;
end;
$$;

drop trigger if exists ticket_watches_enforce_limit on public.ticket_watches;
create trigger ticket_watches_enforce_limit
  before insert on public.ticket_watches
  for each row
  execute function public.enforce_ticket_watch_limit();

-- Matching mirrors the filter logic in src/app/(tabs)/index.tsx exactly: a
-- null column means "any", "Annan" also covers the legacy "Annan:<name>"
-- rows, and a deal type matches listings marked "both". Keep the two in
-- sync -- a watch that notifies about something the same filter wouldn't
-- show is worse than no watch at all.
create or replace function public.notify_ticket_watchers()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  listing_title text;
  listing_body text;
  chunk jsonb;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  -- event_name is already "<organizer> – <ticket type>" (see sell.tsx).
  -- Swedish only: the trigger has no way to know the reader's app language.
  listing_title := new.event_name;
  listing_body := concat_ws(
    ' · ',
    case when new.quantity >= 21 then '20+ st' else new.quantity || ' st' end,
    case
      when new.deal_type = 'trade' then 'Bytes'
      when new.price is null then 'Säljes'
      else round(new.price)::int || ' kr/st'
    end,
    case
      when new.event_date is null then null
      else extract(day from new.event_date)::int || ' ' ||
           (array['jan','feb','mars','apr','maj','juni','juli','aug','sep','okt','nov','dec'])[extract(month from new.event_date)::int]
    end
  );

  -- Expo takes at most 100 messages per request, hence the buckets.
  for chunk in
    select jsonb_agg(
             jsonb_build_object(
               'to', bucketed.token,
               'title', listing_title,
               'body', listing_body,
               'data', jsonb_build_object('type', 'watch', 'listingId', new.id)
             )
           )
    from (
      select token, (row_number() over (order by token) - 1) / 100 as bucket
      from (
        select distinct p.token
        from public.ticket_watches w
        join public.push_tokens p on p.user_id = w.user_id and p.enabled
        where w.user_id <> new.user_id
          and (w.nation_id is null or w.nation_id = new.nation_id)
          and (
            w.ticket_type is null
            or (w.ticket_type = 'Annan' and (new.ticket_type = 'Annan' or new.ticket_type like 'Annan:%'))
            or w.ticket_type = new.ticket_type
          )
          and (
            w.deal_type is null
            or (w.deal_type = 'sell' and new.deal_type in ('sell', 'both'))
            or (w.deal_type = 'trade' and new.deal_type in ('trade', 'both'))
          )
          and (
            w.event_dates is null
            or (new.event_date is not null and new.event_date = any (w.event_dates))
          )
          and not exists (
            select 1
            from public.blocked_users b
            where (b.blocker_id = w.user_id and b.blocked_id = new.user_id)
               or (b.blocker_id = new.user_id and b.blocked_id = w.user_id)
          )
      ) matched
    ) bucketed
    group by bucketed.bucket
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := chunk
    );
  end loop;

  return new;
exception
  when others then
    -- An AFTER INSERT trigger that raises rolls back the insert that fired
    -- it, which is exactly how notify_new_message() once broke all chat
    -- (20260831120000_fix_notify_new_message_column.sql). A missed
    -- notification must never cost someone their listing.
    return new;
end;
$$;

drop trigger if exists listings_notify_watchers on public.listings;
create trigger listings_notify_watchers
  after insert on public.listings
  for each row
  execute function public.notify_ticket_watchers();
