-- Route "mark as sold" through a security-definer function instead of a
-- direct client-side UPDATE. The listings table's UPDATE RLS check has
-- been unreliable in practice (see debugging session), so this sidesteps
-- it entirely: the function runs with the owner's privileges (bypassing
-- RLS for the write) while still enforcing ownership itself via the
-- explicit user_id check below. Run this once in the Supabase SQL editor.

create or replace function public.mark_listing_sold(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set status = 'sold'
  where id = target_listing_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Listing not found or not owned by the current user.';
  end if;
end;
$$;

grant execute on function public.mark_listing_sold(uuid) to authenticated;
