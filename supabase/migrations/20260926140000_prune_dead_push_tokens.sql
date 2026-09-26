-- Notifications that quietly stop working. Run this once in the Supabase SQL
-- editor.
--
-- Every push goes out with pg_net and nobody has ever read the answer. When
-- someone deletes the app, Expo replies DeviceNotRegistered and we carry on
-- sending to that token forever: wasted requests, and — worse — no way to
-- tell a broken notification setup from a phone that is simply gone.
--
-- Three parts:
--   * send_push() is now the one place a push leaves from, and it writes down
--     which tokens went in which request;
--   * prune_dead_push_tokens() reads the replies pg_net kept, and removes the
--     tokens Expo says no longer exist;
--   * an hourly job runs it, since pg_net only keeps its replies a few hours.
--
-- The three senders are re-declared to call send_push instead of net.http_post
-- directly. Their bodies are otherwise unchanged.

create table if not exists public.push_sends (
  id bigint primary key,
  tokens text[] not null,
  created_at timestamptz not null default now()
);

create index if not exists push_sends_created_at_idx on public.push_sends (created_at);

-- Nobody but the triggers touches this table.
revoke all on table public.push_sends from public, anon, authenticated;
alter table public.push_sends enable row level security;

/*
 * Sends one push request and records its tokens. Takes either a single Expo
 * message or an array of them; the array is what comes back in the reply, in
 * the same order, which is how a failing token is identified later.
 */
create or replace function public.send_push(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payload jsonb := case when jsonb_typeof(p_body) = 'array' then p_body else jsonb_build_array(p_body) end;
  request_id bigint;
begin
  if jsonb_array_length(payload) = 0 then
    return;
  end if;

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    body := payload
  ) into request_id;

  insert into public.push_sends (id, tokens)
  select request_id, array_agg(message ->> 'to' order by ordinality)
  from jsonb_array_elements(payload) with ordinality as t(message, ordinality)
  on conflict (id) do nothing;
exception
  when others then
    -- A push that cannot be sent must never cost someone their message,
    -- listing or lost-item post.
    return;
end;
$$;

revoke all on function public.send_push(jsonb) from public, anon, authenticated;

/*
 * Reads what Expo answered and drops the tokens it rejected. Only
 * DeviceNotRegistered is acted on: it means the app is gone from that phone.
 * Anything else (a rate limit, a bad message) is left alone, since the token
 * itself may still be good.
 */
create or replace function public.prune_dead_push_tokens()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  removed int := 0;
begin
  -- pg_net keeps its replies in net._http_response for a few hours. If the
  -- table is not there, there is nothing to read and nothing to do.
  if to_regclass('net._http_response') is null then
    delete from public.push_sends where created_at < now() - interval '1 day';
    return 0;
  end if;

  with answered as (
    select s.id, s.tokens, r.content::jsonb as reply
    from public.push_sends s
    join net._http_response r on r.id = s.id
    where r.status_code = 200 and r.content is not null
  ),
  tickets as (
    select a.id, a.tokens[t.ordinality] as token, t.ticket
    from answered a
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(a.reply -> 'data') = 'array' then a.reply -> 'data'
        when a.reply -> 'data' is null then '[]'::jsonb
        else jsonb_build_array(a.reply -> 'data')
      end
    ) with ordinality as t(ticket, ordinality)
  ),
  gone as (
    select distinct token
    from tickets
    where ticket ->> 'status' = 'error'
      and ticket -> 'details' ->> 'error' = 'DeviceNotRegistered'
      and token is not null
  ),
  deleted as (
    delete from public.push_tokens p
    using gone g
    where p.token = g.token
    returning 1
  )
  select count(*) into removed from deleted;

  -- Read once. Anything older than a day is past pg_net's own retention.
  delete from public.push_sends s
  using net._http_response r
  where r.id = s.id;

  delete from public.push_sends where created_at < now() - interval '1 day';

  return removed;
exception
  when others then
    return removed;
end;
$$;

revoke all on function public.prune_dead_push_tokens() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'prune-dead-push-tokens') then
    perform cron.unschedule('prune-dead-push-tokens');
  end if;
end $$;

select cron.schedule('prune-dead-push-tokens', '20 * * * *', $$select public.prune_dead_push_tokens();$$);

-- --------------------------------------------------- the three senders
--
-- Same functions as before, sending through send_push so the reply can be
-- matched to its tokens. Nothing else in them is changed.

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient_id uuid;
  recipient_token text;
  sender_name text;
begin
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
  into recipient_id
  from public.conversations c
  where c.id = new.conversation_id;

  if recipient_id is null then
    return new;
  end if;

  select token into recipient_token
  from public.push_tokens
  where user_id = recipient_id and enabled = true;

  if recipient_token is null then
    return new;
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
  into sender_name
  from auth.users
  where id = new.sender_id;

  perform public.send_push(jsonb_build_object(
    'to', recipient_token,
    'title', coalesce(sender_name, 'Nytt meddelande'),
    'body', left(new.body, 120),
    'data', jsonb_build_object('conversationId', new.conversation_id)
  ));

  return new;
end;
$$;

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
    perform public.send_push(chunk);
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

create or replace function public.notify_lost_item_matches()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  category_label text;
  match_title text;
  match_body text;
  chunk jsonb;
begin
  if new.status is distinct from 'open' then
    return new;
  end if;

  -- Swedish only: the trigger cannot know the reader's app language. The
  -- category is one of a fixed set, so nothing here is user-written.
  category_label := case new.category
    when 'jacket' then 'Jacka'
    when 'phone' then 'Telefon'
    when 'keys' then 'Nycklar'
    when 'wallet' then 'Plånbok'
    when 'id' then 'Leg / ID'
    when 'headphones' then 'Hörlurar'
    when 'bag' then 'Väska'
    when 'jewelry' then 'Smycke'
    when 'watch' then 'Klocka'
    when 'clothing' then 'Klädesplagg'
    else 'Borttappat'
  end;

  match_title := case
    when new.kind = 'found' then 'Någon har hittat något du kanske söker'
    else 'Någon söker något du kanske hittat'
  end;

  match_body := category_label || ' · ' ||
    extract(day from new.happened_on)::int || ' ' ||
    (array['jan','feb','mars','apr','maj','juni','juli','aug','sep','okt','nov','dec'])[
      extract(month from new.happened_on)::int];

  for chunk in
    select jsonb_agg(
             jsonb_build_object(
               'to', bucketed.token,
               'title', match_title,
               'body', match_body,
               'data', jsonb_build_object('type', 'lostItem', 'lostItemId', new.id)
             )
           )
    from (
      select token, (row_number() over (order by token) - 1) / 100 as bucket
      from (
        select distinct p.token
        from public.lost_items other
        join public.push_tokens p on p.user_id = other.user_id and p.enabled
        where other.user_id <> new.user_id
          and other.status = 'open'
          and other.kind <> new.kind
          and other.category = new.category
          and other.nation_id = new.nation_id
          and abs(other.happened_on - new.happened_on) <= 1
          and not exists (
            select 1
            from public.blocked_users b
            where (b.blocker_id = other.user_id and b.blocked_id = new.user_id)
               or (b.blocker_id = new.user_id and b.blocked_id = other.user_id)
          )
      ) matched
    ) bucketed
    group by bucketed.bucket
  loop
    perform public.send_push(chunk);
  end loop;

  return new;
exception
  when others then
    -- An AFTER INSERT trigger that raises rolls back the insert that fired it.
    -- A missed notification must never cost someone their post.
    return new;
end;
$$;
