-- Push notifications for new chat messages only. Run this once in the
-- Supabase SQL editor (there is no linked Supabase CLI project in this
-- repo, so it isn't applied automatically).
--
-- pg_net lets a trigger fire an outbound HTTP request without blocking
-- the insert; it ships with every Supabase project but can be off by
-- default, hence the explicit create here.
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can manage their own push token" on public.push_tokens;
create policy "Users can manage their own push token"
  on public.push_tokens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fires only after a message insert survives the rate-limit trigger in
-- 20260709090000_create_messaging.sql, so this never double-notifies.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipient_id uuid;
  recipient_token text;
  sender_name text;
begin
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
  into recipient_id
  from public.conversations c
  where c.id = new.conversation_id;

  if recipient_id is null then
    return new;
  end if;

  select token into recipient_token
  from public.push_tokens
  where user_id = recipient_id and enabled = true;

  if recipient_token is null then
    return new;
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
  into sender_name
  from auth.users
  where id = new.sender_id;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    body := jsonb_build_object(
      'to', recipient_token,
      'title', coalesce(sender_name, 'Nytt meddelande'),
      'body', left(new.text, 120),
      'data', jsonb_build_object('conversationId', new.conversation_id)
    )
  );

  return new;
end;
$$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
  after insert on public.messages
  for each row
  execute function public.notify_new_message();
