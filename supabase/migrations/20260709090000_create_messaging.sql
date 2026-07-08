-- Real chat: conversations + messages, replacing the client-only mock in
-- src/lib/messages.ts. Run this once in the Supabase SQL editor (there is
-- no linked Supabase CLI project in this repo, so it isn't applied
-- automatically).

-- One conversation per (listing, buyer) pair. seller_id is derived
-- server-side from the listing's owner, so a buyer never needs to know
-- (or send) the seller's user id directly.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index if not exists conversations_buyer_id_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations (seller_id);

create or replace function public.set_conversation_seller_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select user_id into new.seller_id from public.listings where id = new.listing_id;
  return new;
end;
$$;

drop trigger if exists conversations_set_seller_id on public.conversations;
create trigger conversations_set_seller_id
  before insert on public.conversations
  for each row
  execute function public.set_conversation_seller_id();

alter table public.conversations enable row level security;

drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations
  for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can start a conversation" on public.conversations;
create policy "Buyers can start a conversation"
  on public.conversations
  for insert
  to authenticated
  with check (auth.uid() = buyer_id);

-- Messages, scoped to a conversation.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_id_created_at_idx on public.messages (sender_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Participants can view conversation messages" on public.messages;
create policy "Participants can view conversation messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

-- Rate limiting, enforced server-side so it can't be bypassed from the
-- client: short bursts are capped tightly, with looser per-minute and
-- per-24h ceilings on top. Tune the thresholds below as needed.
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  count_10s int;
  count_60s int;
  count_24h int;
begin
  select count(*) into count_10s from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '10 seconds';
  if count_10s >= 5 then
    raise exception 'Du skickar meddelanden för snabbt. Vänta några sekunder och försök igen.';
  end if;

  select count(*) into count_60s from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if count_60s >= 20 then
    raise exception 'Du har skickat för många meddelanden den senaste minuten. Vänta lite och försök igen.';
  end if;

  select count(*) into count_24h from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '24 hours';
  if count_24h >= 300 then
    raise exception 'Du har nått dagens gräns för antal meddelanden. Försök igen imorgon.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row
  execute function public.enforce_message_rate_limit();

-- Realtime, so both participants see new messages live. No-op if the
-- table is already part of the publication (e.g. added earlier via the
-- Dashboard).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;
