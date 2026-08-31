-- The messages table's text column is actually named "body" in production
-- (the original create_messaging migration's column name never matched
-- reality), but notify_new_message() still referenced "new.text". That made
-- every message insert fail with `record "new" has no field "text"`, since
-- an AFTER INSERT trigger error rolls back the whole insert. Run this once
-- in the Supabase SQL editor to fix live sending.
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
      'body', left(new.body, 120),
      'data', jsonb_build_object('conversationId', new.conversation_id)
    )
  );

  return new;
end;
$$;
