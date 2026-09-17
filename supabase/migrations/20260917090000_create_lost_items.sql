-- Lost and found: someone posts what they lost during the evening, someone
-- else posts what they picked up, and either side can start a chat. Run this
-- once in the Supabase SQL editor.
--
-- Both directions exist on purpose. The person who lost something searches
-- actively; the person who found something is holding the answer without
-- knowing whose it is. With both sides posting, the trigger at the bottom can
-- put them in touch without either of them checking back.
--
-- Category, nation and date are structured fields rather than free text
-- precisely because that is what makes the matching possible.
create extension if not exists pg_net with schema extensions;

create table if not exists public.lost_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('lost', 'found')),
  category text not null check (
    category in ('jacket', 'phone', 'keys', 'wallet', 'headphones', 'bag', 'jewelry', 'clothing', 'other')
  ),
  nation_id text not null check (char_length(nation_id) between 1 and 40),
  happened_on date not null,
  description text check (description is null or char_length(description) <= 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  reporter_name text check (reporter_name is null or char_length(reporter_name) <= 40),
  reporter_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lost_items_open_idx
  on public.lost_items (status, happened_on desc);
create index if not exists lost_items_user_id_idx
  on public.lost_items (user_id, created_at desc);
create index if not exists lost_items_match_idx
  on public.lost_items (kind, category, nation_id, happened_on);

alter table public.lost_items enable row level security;

-- Signed-out visitors have no business reading what people lost: the posts
-- describe personal property and, between the lines, where someone was on a
-- given night.
revoke all on public.lost_items from anon;
grant select, insert, update, delete on public.lost_items to authenticated;

drop policy if exists "Lost items are readable by signed-in users" on public.lost_items;
create policy "Lost items are readable by signed-in users"
  on public.lost_items
  for select
  to authenticated
  using (true);

drop policy if exists "Users can post their own lost items" on public.lost_items;
create policy "Users can post their own lost items"
  on public.lost_items
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own lost items" on public.lost_items;
create policy "Users can update their own lost items"
  on public.lost_items
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own lost items" on public.lost_items;
create policy "Users can delete their own lost items"
  on public.lost_items
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view all lost items" on public.lost_items;
create policy "Admins can view all lost items"
  on public.lost_items
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete any lost item" on public.lost_items;
create policy "Admins can delete any lost item"
  on public.lost_items
  for delete
  to authenticated
  using (public.is_admin());

-- Same shape as the listing limits in 20260916120000_content_limits.sql.
--   23W06  too many posts in 24h
--   23W07  too many open posts
create or replace function public.enforce_lost_item_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  open_count int;
begin
  select count(*) into recent_count
  from public.lost_items
  where user_id = new.user_id and created_at > now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception 'Du har lagt upp många efterlysningar idag.' using errcode = '23W06';
  end if;

  select count(*) into open_count
  from public.lost_items
  where user_id = new.user_id and status = 'open';

  if open_count >= 10 then
    raise exception 'Du har för många öppna efterlysningar.' using errcode = '23W07';
  end if;

  return new;
end;
$$;

drop trigger if exists lost_items_enforce_limits on public.lost_items;
create trigger lost_items_enforce_limits
  before insert on public.lost_items
  for each row
  execute function public.enforce_lost_item_limits();

create or replace function public.touch_lost_item()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lost_items_touch on public.lost_items;
create trigger lost_items_touch
  before update on public.lost_items
  for each row
  execute function public.touch_lost_item();

-- ------------------------------------------------------- chat on a lost item
--
-- Conversations carry either a listing or a lost item, never both. Everything
-- built on conversations — the inbox, unread counts, push on a new message,
-- blocking, reporting — keeps working untouched, because none of it looks at
-- what the conversation is about.
alter table public.conversations
  add column if not exists lost_item_id uuid references public.lost_items (id) on delete cascade;

alter table public.conversations
  alter column listing_id drop not null;

do $$
begin
  alter table public.conversations
    add constraint conversations_subject_present
      check ((listing_id is null) <> (lost_item_id is null)) not valid;
exception when duplicate_object then null;
end $$;

-- One conversation per (lost item, the person who got in touch), mirroring the
-- unique (listing_id, buyer_id) that already exists for listings.
create unique index if not exists conversations_lost_item_buyer_idx
  on public.conversations (lost_item_id, buyer_id)
  where lost_item_id is not null;

create index if not exists conversations_lost_item_id_idx
  on public.conversations (lost_item_id);

-- buyer_id is whoever started the conversation and seller_id the owner of the
-- post, for a lost item just as for a listing. The names are inherited; what
-- matters is that the client still cannot choose who it is talking to.
create or replace function public.set_conversation_seller_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lost_item_id is not null then
    select user_id into new.seller_id from public.lost_items where id = new.lost_item_id;
  else
    select user_id into new.seller_id from public.listings where id = new.listing_id;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------- notifications
--
-- When a post appears that matches an open post from the other direction, tell
-- the other person. Same night (give or take a day, since a Saturday club night
-- ends on Sunday and people disagree about which it was), same nation, same
-- category.
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
  -- category is one of nine fixed values, so nothing here is user-written.
  category_label := case new.category
    when 'jacket' then 'Jacka'
    when 'phone' then 'Telefon'
    when 'keys' then 'Nycklar'
    when 'wallet' then 'Plånbok eller ID'
    when 'headphones' then 'Hörlurar'
    when 'bag' then 'Väska'
    when 'jewelry' then 'Smycke eller klocka'
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
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := chunk
    );
  end loop;

  return new;
exception
  when others then
    -- An AFTER INSERT trigger that raises rolls back the insert that fired it.
    -- A missed notification must never cost someone their post.
    return new;
end;
$$;

drop trigger if exists lost_items_notify_matches on public.lost_items;
create trigger lost_items_notify_matches
  after insert on public.lost_items
  for each row
  execute function public.notify_lost_item_matches();

-- ---------------------------------------------------------------- expiry
--
-- A jacket nobody claimed in three weeks is not coming back through the app,
-- and a list that only grows stops being worth opening. Mirrors
-- delete_expired_listings() from 20260906090000.
create or replace function public.delete_expired_lost_items()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.lost_items
  where happened_on < (now() at time zone 'Europe/Stockholm')::date - 21;
end;
$$;

revoke all on function public.delete_expired_lost_items() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-expired-lost-items') then
    perform cron.unschedule('delete-expired-lost-items');
  end if;
end $$;

select cron.schedule('delete-expired-lost-items', '15 1 * * *', $$select public.delete_expired_lost_items();$$);
