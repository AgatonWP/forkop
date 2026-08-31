import { supabase } from '@/lib/supabase';

export async function getBlockStatus(
  otherUserId: string,
): Promise<{ blockedByMe: boolean; interactionBlocked: boolean }> {
  const { data, error } = await supabase.rpc('get_block_status', {
    other_user_id: otherUserId,
  });

  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    blockedByMe: row?.blocked_by_me ?? false,
    interactionBlocked: row?.interaction_blocked ?? false,
  };
}

export async function blockUser(currentUserId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: currentUserId,
    blocked_id: otherUserId,
  });

  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function unblockUser(currentUserId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', currentUserId)
    .eq('blocked_id', otherUserId);

  if (error) throw new Error(error.message);
}
