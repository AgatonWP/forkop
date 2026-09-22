-- Lost and found, round two. Run this once in the Supabase SQL editor, after
-- 20260922090000_lost_item_place.sql.
--
--   * "Plånbok eller ID" and "Smycke eller klocka" split in two: people lose
--     just their ID, or just their watch. 'wallet' and 'jewelry' keep their
--     ids and now mean only the wallet and the jewellery; 'id' and 'watch'
--     are new.
--   * An optional free-text name for posts under "Annat", such as "paraply".
--   * Gasquesalen as a place, where the sections hold their eftersläpp.
--
-- Everything here only adds. An app version from before this migration would
-- show an 'id' or 'watch' post with no title and a Gasquesalen post under its
-- raw id, so those rows are hidden from it through client_api_version(), the
-- way wanted posts are in 20260921090000_wanted_listings.sql. The app sends 3
-- from this version on.

-- ----------------------------------------------------------------- categories
--
-- The original check was declared on the column, so Postgres named it
-- lost_items_category_check. Every value it allowed is still allowed, so the
-- existing rows pass the new one.
alter table public.lost_items drop constraint if exists lost_items_category_check;
alter table public.lost_items
  add constraint lost_items_category_check check (
    category in (
      'jacket', 'phone', 'keys', 'wallet', 'id', 'headphones', 'bag',
      'jewelry', 'watch', 'clothing', 'other'
    )
  );

-- ------------------------------------------------------------------ item name

alter table public.lost_items
  add column if not exists item_name text;

do $$
begin
  alter table public.lost_items
    add constraint lost_items_item_name_len
      check (item_name is null or char_length(item_name) between 1 and 40);
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------- older app versions
--
-- Restrictive, so AND-ed with the existing read policies, and true for every
-- row an older app already understands: it can only hide the new ones.
drop policy if exists "Older app versions only see what they understand" on public.lost_items;
create policy "Older app versions only see what they understand"
  on public.lost_items
  as restrictive
  for select
  to authenticated
  using (
    (category not in ('id', 'watch') and nation_id <> 'gasquesalen')
    or (select public.client_api_version()) >= 3
  );

-- -------------------------------------------------------------- notifications
--
-- Same function as in 20260917090000_create_lost_items.sql with the labels
-- brought in line with the app. Push texts stay free of anything user-written,
-- so a post under "Annat" still says "Borttappat" rather than its item name.
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
