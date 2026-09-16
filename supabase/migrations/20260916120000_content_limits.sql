-- Limits on user-generated content. Until now a single account could post an
-- unbounded number of listings, with unbounded text in every field — and
-- listings.event_name goes straight into the title of a watch push
-- notification. Run this once in the Supabase SQL editor.
--
-- The length checks are added NOT VALID on purpose: they apply to every new
-- insert and update from this moment on, but they don't reject rows that were
-- already in the table when the migration ran (there are rows from the old
-- Lovable-era app that nobody has audited). Validate them later with
--   alter table public.listings validate constraint <name>;
-- once `select * from public.listings where char_length(description) > 1000`
-- and friends come back empty.
--
-- The rate limits mirror enforce_message_rate_limit() from
-- 20260709090000_create_messaging.sql. Each one raises a SQLSTATE of its own
-- so the app can say which limit was hit, in Swedish, instead of leaking the
-- message text below:
--   23W02  too many listings too quickly
--   23W03  too many active listings
--   23W04  too many reports in 24h
--   23W05  too many new conversations in an hour
-- Codes must not start with "PT" — PostgREST reads those as an HTTP status.

-- ---------------------------------------------------------------- listings

do $$
begin
  alter table public.listings
    add constraint listings_event_name_len
      check (char_length(event_name) between 1 and 80) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.listings
    add constraint listings_ticket_type_len
      check (char_length(ticket_type) between 1 and 40) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.listings
    add constraint listings_description_len
      check (description is null or char_length(description) <= 1000) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.listings
    add constraint listings_trade_description_len
      check (trade_description is null or char_length(trade_description) <= 200) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.listings
    add constraint listings_seller_name_len
      check (seller_name is null or char_length(seller_name) <= 40) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.listings
    add constraint listings_quantity_range
      check (quantity between 1 and 21) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.listings
    add constraint listings_price_range
      check (price is null or (price >= 0 and price <= 3000)) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists listings_user_id_created_at_idx
  on public.listings (user_id, created_at desc);

create or replace function public.enforce_listing_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  active_count int;
  active_allowance int := 30;
begin
  select count(*) into recent_count
  from public.listings
  where user_id = new.user_id and created_at > now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Du lägger upp annonser för snabbt.' using errcode = '23W02';
  end if;

  -- A verified nation runs its official ticket releases through one account,
  -- so the cap that suits a student would get in their way. The to_regclass
  -- guard matters: plpgsql resolves the table at execution time, so without it
  -- a database where 20260915090000_create_verified_organizers.sql hasn't run
  -- would fail every listing insert rather than just skipping the allowance.
  if to_regclass('public.verified_organizers') is not null then
    if exists (select 1 from public.verified_organizers v where v.user_id = new.user_id) then
      active_allowance := 100;
    end if;
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

drop trigger if exists listings_enforce_limits on public.listings;
create trigger listings_enforce_limits
  before insert on public.listings
  for each row
  execute function public.enforce_listing_limits();

-- ----------------------------------------------------------------- reports

do $$
begin
  alter table public.reports
    add constraint reports_reason_len check (char_length(reason) between 1 and 60) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.reports
    add constraint reports_details_len
      check (details is null or char_length(details) <= 1000) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists reports_reporter_id_created_at_idx
  on public.reports (reporter_id, created_at desc);

create or replace function public.enforce_report_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.reports
  where reporter_id = new.reporter_id and created_at > now() - interval '24 hours';

  if recent_count >= 10 then
    raise exception 'Du har skickat många rapporter idag.' using errcode = '23W04';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_enforce_limits on public.reports;
create trigger reports_enforce_limits
  before insert on public.reports
  for each row
  execute function public.enforce_report_limits();

-- ----------------------------------------------------------- conversations

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

  if recent_count >= 20 then
    raise exception 'Du har startat många chattar den senaste timmen.' using errcode = '23W05';
  end if;

  return new;
end;
$$;

-- Runs after conversations_set_seller_id (alphabetical order among BEFORE
-- triggers), which doesn't matter here: this one only reads buyer_id.
drop trigger if exists conversations_enforce_limits on public.conversations;
create trigger conversations_enforce_limits
  before insert on public.conversations
  for each row
  execute function public.enforce_conversation_limits();
