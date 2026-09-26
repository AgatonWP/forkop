-- The inbox, without reading every message you have ever sent. Run this once
-- in the Supabase SQL editor.
--
-- To show "Hej! Finns de kvar?" under each row, the app fetched every message
-- in every conversation it is part of and kept the newest of each — and did it
-- again each time anyone, anywhere in the app, sent a message. With a few
-- hundred conversations that is tens of thousands of rows for twenty lines of
-- text.
--
-- distinct on does the same work in the database, over the index that already
-- exists on (conversation_id, created_at): one row per conversation.
--
-- Security definer with the participant check written out: the same rows the
-- RLS policy on messages allows, but as one indexed lookup rather than a
-- policy subquery per row. Nothing here can return a message from a
-- conversation the caller is not in.

create or replace function public.latest_messages()
returns table (
  conversation_id uuid,
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.id,
    m.sender_id,
    m.body,
    m.created_at
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where (select auth.uid()) in (c.buyer_id, c.seller_id)
  order by m.conversation_id, m.created_at desc;
$$;

revoke all on function public.latest_messages() from public, anon;
grant execute on function public.latest_messages() to authenticated;
