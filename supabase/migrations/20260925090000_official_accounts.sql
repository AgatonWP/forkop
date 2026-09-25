-- Official accounts: an association that sells tickets to other people's
-- events — LTH Griparna, who have spare förköp left over from most matches —
-- runs an account whose listings carry its own name and tick. Run this once in
-- the Supabase SQL editor.
--
-- Deliberately separate from verified_organizers, which says "this account is
-- the organizer of what it is selling" and only lights up on that organizer's
-- own listings. An official account is vouched for whatever it sells.
--
-- Only adds. An app version that knows nothing about this simply shows their
-- listings without the tick, as it does today.

create table if not exists public.official_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Shown on the badge, e.g. "LTH Griparna". Not the account's display name,
  -- which the account holder can change at any time.
  name text not null check (char_length(btrim(name)) between 1 and 40),
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users (id) on delete set null
);

alter table public.official_accounts enable row level security;

-- Public by design: the badge has to show to everyone, and listings already
-- expose user_id.
grant select on public.official_accounts to anon, authenticated;

drop policy if exists "Official accounts are publicly readable" on public.official_accounts;
create policy "Official accounts are publicly readable"
  on public.official_accounts
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete grant: the admin functions below are the only way
-- in, which is what stops an account marking itself official.

create or replace function public.admin_add_official_account(p_email text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'no account with that email';
  end if;

  insert into public.official_accounts (user_id, name, verified_by)
  values (v_user_id, btrim(p_name), (select auth.uid()))
  on conflict (user_id) do update
    set name = excluded.name,
        verified_at = now(),
        verified_by = excluded.verified_by;

  return v_user_id;
end;
$$;

create or replace function public.admin_remove_official_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.official_accounts where user_id = p_user_id;
end;
$$;

create or replace function public.admin_list_official_accounts()
returns table (user_id uuid, email text, name text, verified_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select o.user_id, u.email::text, o.name, o.verified_at
    from public.official_accounts o
    join auth.users u on u.id = o.user_id
    order by o.verified_at desc;
end;
$$;

revoke all on function public.admin_add_official_account(text, text) from public, anon;
revoke all on function public.admin_remove_official_account(uuid) from public, anon;
revoke all on function public.admin_list_official_accounts() from public, anon;
grant execute on function public.admin_add_official_account(text, text) to authenticated;
grant execute on function public.admin_remove_official_account(uuid) to authenticated;
grant execute on function public.admin_list_official_accounts() to authenticated;

-- ------------------------------------------------------------------ quantity
--
-- A listing has been capped at 21, where 21 means "20+". An official account
-- with 40 spare tickets should be able to say so, but a private seller with 40
-- tickets is a tout, so the higher ceiling is theirs alone. The check
-- constraint cannot ask another table, so it is widened and a trigger holds
-- everyone else to the old limit.
alter table public.listings drop constraint if exists listings_quantity_range;

do $$
begin
  alter table public.listings
    add constraint listings_quantity_range check (quantity between 1 and 50);
exception when duplicate_object then null;
end $$;

create or replace function public.enforce_listing_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quantity > 21
     and not exists (select 1 from public.official_accounts o where o.user_id = new.user_id) then
    raise exception 'Bara officiella konton kan lägga upp fler än 20 biljetter.'
      using errcode = '23W08';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_quantity on public.listings;
create trigger listings_enforce_quantity
  before insert or update of quantity on public.listings
  for each row
  execute function public.enforce_listing_quantity();
