-- Removing a conversation from the inbox. Run this once in the Supabase SQL
-- editor.
--
-- Removing is per person and immediate: the conversation leaves your inbox,
-- while the other person keeps theirs. The row itself stays, for a while, so
-- there is something to go on if one of them reports the other afterwards.
-- Only once both have removed it, and two weeks have passed since the second
-- did, is it deleted for good, messages and all.
--
-- A new message after you removed a conversation brings it back, showing only
-- what was written since. That is decided in the app from the timestamps
-- below; the database only records when each side removed it.
--
-- Only adds. App versions that know nothing about this never set the columns,
-- so their conversations are never deleted by it.

alter table public.conversations
  add column if not exists buyer_hidden_at timestamptz,
  add column if not exists seller_hidden_at timestamptz;

-- Conversations have no update policy, and should not get one: an update
-- policy would let a participant rewrite the whole row. This function touches
-- nothing but the caller's own timestamp.
create or replace function public.hide_conversation(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  update public.conversations
  set buyer_hidden_at = case when buyer_id = me then now() else buyer_hidden_at end,
      seller_hidden_at = case when seller_id = me then now() else seller_hidden_at end
  where id = target_conversation_id
    and (buyer_id = me or seller_id = me);
end;
$$;

revoke all on function public.hide_conversation(uuid) from public, anon;
grant execute on function public.hide_conversation(uuid) to authenticated;

-- --------------------------------------------------------------------- cleanup
--
-- Removed by both, nothing written since the earlier of the two removals (a
-- later message would have brought it back for that person), and the later
-- removal at least two weeks old.
create or replace function public.delete_hidden_conversations()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.conversations c
  where c.buyer_hidden_at is not null
    and c.seller_hidden_at is not null
    and greatest(c.buyer_hidden_at, c.seller_hidden_at) < now() - interval '14 days'
    and not exists (
      select 1
      from public.messages m
      where m.conversation_id = c.id
        and m.created_at > least(c.buyer_hidden_at, c.seller_hidden_at)
    );
end;
$$;

revoke all on function public.delete_hidden_conversations() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-hidden-conversations') then
    perform cron.unschedule('delete-hidden-conversations');
  end if;
end $$;

select cron.schedule('delete-hidden-conversations', '30 1 * * *', $$select public.delete_hidden_conversations();$$);
