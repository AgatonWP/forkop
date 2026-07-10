-- Two fixes:
--
-- 1. The only SELECT policy on listings was "Active listings are public"
--    (status = 'active'), so the moment a listing was marked sold, RLS
--    hid it from EVERYONE — including its own owner. Add a policy that
--    lets owners see all of their own listings regardless of status.
--
-- 2. A "restore to active" RPC, mirroring mark_listing_sold, so a sold
--    listing can be put back within the app's 24h keep-window using the
--    same reliable security-definer pattern (the plain client-side
--    UPDATE policy on this table has proven unreliable — see the
--    mark_listing_sold migration).
--
-- Run this once in the Supabase SQL editor.

drop policy if exists "Owners can view their own listings" on public.listings;
create policy "Owners can view their own listings"
  on public.listings
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.restore_listing_active(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set status = 'active'
  where id = target_listing_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Listing not found or not owned by the current user.';
  end if;
end;
$$;

grant execute on function public.restore_listing_active(uuid) to authenticated;
