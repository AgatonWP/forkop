-- Reports could only ever point at a listing, so a lost-and-found post had no
-- way to be reported at all. Same shape as the change conversations got in
-- 20260917090000: a report carries either a listing or a lost item, never both,
-- and everything already built on reports — the admin view, the 10-a-day rate
-- limit, the "only admins can read" rules — keeps working untouched.
-- Run this once in the Supabase SQL editor, after the lost_items migration.

alter table public.reports
  add column if not exists lost_item_id uuid references public.lost_items (id) on delete cascade;

alter table public.reports
  alter column listing_id drop not null;

create index if not exists reports_lost_item_id_idx on public.reports (lost_item_id);

do $$
begin
  alter table public.reports
    add constraint reports_subject_present
      check ((listing_id is null) <> (lost_item_id is null)) not valid;
exception when duplicate_object then null;
end $$;

-- target_type was created inline as check (target_type in ('listing','profile')),
-- so the constraint carries whatever name Postgres generated. Find it by its
-- definition rather than guessing, then widen it.
do $$
declare
  existing record;
begin
  for existing in
    select conname
    from pg_constraint
    where conrelid = 'public.reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%target_type%'
  loop
    execute format('alter table public.reports drop constraint %I', existing.conname);
  end loop;

  alter table public.reports
    add constraint reports_target_type_check
      check (target_type in ('listing', 'profile', 'lost_item'));
end $$;

-- Still derived server-side, so a reporter cannot name someone else as the
-- reported party.
create or replace function public.set_report_reported_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lost_item_id is not null then
    select user_id into new.reported_user_id
    from public.lost_items
    where id = new.lost_item_id;
  else
    select user_id into new.reported_user_id
    from public.listings
    where id = new.listing_id;
  end if;

  return new;
end;
$$;
