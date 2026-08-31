-- Minimal admin capability so the app owner can moderate listings/reports
-- from inside the app itself, without a service-role key ever touching the
-- client. Run this once in the Supabase SQL editor.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon;
grant select on public.admins to authenticated;

-- Deliberately no insert/update/delete policy: the only way to grant admin
-- access is to run "insert into public.admins (user_id) values ('<uuid>');"
-- directly in the SQL editor (service role bypasses RLS), never from the app.
drop policy if exists "Users can check their own admin status" on public.admins;
create policy "Users can check their own admin status"
  on public.admins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins can see every listing regardless of status, and delete any of them.
drop policy if exists "Admins can view all listings" on public.listings;
create policy "Admins can view all listings"
  on public.listings
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete any listing" on public.listings;
create policy "Admins can delete any listing"
  on public.listings
  for delete
  to authenticated
  using (public.is_admin());

-- Admins are the only ones who can review reports (regular users never get
-- a select policy on this table, see 20260708120000_create_reports.sql).
drop policy if exists "Admins can view reports" on public.reports;
create policy "Admins can view reports"
  on public.reports
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete reports" on public.reports;
create policy "Admins can delete reports"
  on public.reports
  for delete
  to authenticated
  using (public.is_admin());
