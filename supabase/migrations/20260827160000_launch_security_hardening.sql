-- Minimal iOS launch hardening: private Swish details and 1:1 blocking.
-- Run once after the updated app code is ready for a new build.

create table if not exists public.seller_payment_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  swish_number text not null
    check (char_length(swish_number) between 7 and 24)
    check (swish_number ~ '^\+?[0-9][0-9 +()-]*$'),
  updated_at timestamptz not null default now()
);

alter table public.seller_payment_details enable row level security;
revoke all on public.seller_payment_details from anon;
grant select, insert, update, delete on public.seller_payment_details to authenticated;

drop policy if exists "Sellers manage their payment details" on public.seller_payment_details;
create policy "Sellers manage their payment details"
  on public.seller_payment_details
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Preserve the latest valid value before removing the public column. Guarded
-- so this migration can be re-run safely (e.g. after a `supabase db reset`)
-- once the column has already been dropped by an earlier run.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'seller_swish_number'
  ) then
    insert into public.seller_payment_details (user_id, swish_number, updated_at)
    select distinct on (user_id)
      user_id,
      btrim(seller_swish_number),
      coalesce(updated_at, now())
    from public.listings
    where seller_swish_number is not null
      and btrim(seller_swish_number) <> ''
      and char_length(btrim(seller_swish_number)) between 7 and 24
      and btrim(seller_swish_number) ~ '^\+?[0-9][0-9 +()-]*$'
    order by user_id, updated_at desc
    on conflict (user_id) do update
    set swish_number = excluded.swish_number,
        updated_at = excluded.updated_at;

    alter table public.listings
      drop column seller_swish_number;
  end if;
end $$;

-- Blocking for 1:1 chat.
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocked_id_idx
  on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;
revoke all on public.blocked_users from anon;
grant select, insert, delete on public.blocked_users to authenticated;

drop policy if exists "Users can view blocks they created" on public.blocked_users;
create policy "Users can view blocks they created"
  on public.blocked_users
  for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "Users can block other users" on public.blocked_users;
create policy "Users can block other users"
  on public.blocked_users
  for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can remove blocks they created" on public.blocked_users;
create policy "Users can remove blocks they created"
  on public.blocked_users
  for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);

create or replace function public.get_block_status(other_user_id uuid)
returns table (blocked_by_me boolean, interaction_blocked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.blocked_users b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = other_user_id
    ),
    exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = other_user_id)
         or (b.blocker_id = other_user_id and b.blocked_id = (select auth.uid()))
    );
$$;

revoke all on function public.get_block_status(uuid) from public, anon;
grant execute on function public.get_block_status(uuid) to authenticated;

create or replace function public.is_interaction_blocked(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = other_user_id)
       or (b.blocker_id = other_user_id and b.blocked_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_interaction_blocked(uuid) from public, anon;
grant execute on function public.is_interaction_blocked(uuid) to authenticated;

drop policy if exists "Conversation buyers can read seller payment details" on public.seller_payment_details;
create policy "Conversation buyers can read seller payment details"
  on public.seller_payment_details
  for select
  to authenticated
  using (
    not public.is_interaction_blocked(user_id)
    and exists (
      select 1
      from public.conversations c
      where c.seller_id = seller_payment_details.user_id
        and c.buyer_id = (select auth.uid())
    )
  );

drop policy if exists "Buyers can start a conversation" on public.conversations;
create policy "Buyers can start a conversation"
  on public.conversations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = buyer_id
    and buyer_id <> seller_id
    and not public.is_interaction_blocked(seller_id)
  );

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
        and not public.is_interaction_blocked(
          case
            when (select auth.uid()) = c.buyer_id then c.seller_id
            else c.buyer_id
          end
        )
    )
  );
