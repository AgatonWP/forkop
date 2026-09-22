-- Lost and found: an optional free-text place for posts under "Annat", such as
-- "utanför Clemens Falafel" or "Ericsson's Bar". Run this once in the Supabase
-- SQL editor.
--
-- Only adds. The column is nullable, so every existing post and every post
-- from an app version that does not know about it simply has no place, and
-- shows "Annat" as before. Matching still goes by nation_id alone: two people
-- rarely describe the same spot in the same words.

alter table public.lost_items
  add column if not exists place text;

do $$
begin
  alter table public.lost_items
    add constraint lost_items_place_len
      check (place is null or char_length(place) between 1 and 60);
exception when duplicate_object then null;
end $$;
