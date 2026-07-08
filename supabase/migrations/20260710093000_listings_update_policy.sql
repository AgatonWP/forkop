-- The app has never issued an UPDATE on public.listings before now
-- ("mark as sold" used to hard-delete the row, which was a bug — see
-- markListingSold in src/lib/tickets.ts). If row level security is
-- enabled on listings without an existing UPDATE policy, owners won't be
-- able to change a listing's status at all. Run this once in the
-- Supabase SQL editor; it's safe to re-run.

drop policy if exists "Owners can update their own listings" on public.listings;
create policy "Owners can update their own listings"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
