-- Reports: lets a signed-in user flag a listing, or the seller behind it,
-- for moderation review. Run this once in the Supabase SQL editor
-- (Project > SQL Editor) — there is no linked Supabase CLI project in this
-- repo yet, so it isn't applied automatically.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('listing', 'profile')),
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_listing_id_idx on public.reports (listing_id);
create index if not exists reports_reported_user_id_idx on public.reports (reported_user_id);

-- Auto-fill reported_user_id from the listing's owner, server-side, so the
-- client never needs to know (or send) another user's id.
create or replace function public.set_report_reported_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select user_id into new.reported_user_id
  from public.listings
  where id = new.listing_id;

  return new;
end;
$$;

drop trigger if exists reports_set_reported_user_id on public.reports;
create trigger reports_set_reported_user_id
  before insert on public.reports
  for each row
  execute function public.set_report_reported_user_id();

alter table public.reports enable row level security;

-- Signed-in users can file a report as themselves.
drop policy if exists "Authenticated users can create reports" on public.reports;
create policy "Authenticated users can create reports"
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- No select/update/delete policies are defined on purpose: regular users
-- can't read reports (including their own), so reporters and reported
-- users can't see who reported what. Only the service role (e.g. an admin
-- dashboard using the service key) can review and moderate reports.
