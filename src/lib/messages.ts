import { supabase } from '@/lib/supabase';

export type Message = {
  id: string;
  text: string;
  senderId: string;
  fromMe: boolean;
  sentAt: Date;
};

export type Conversation = {
  id: string;
  /** Exactly one of listingId and lostItemId is set. */
  listingId?: string;
  lostItemId?: string;
  buyerId: string;
  sellerId: string;
  buyerName?: string;
  buyerAvatarUrl?: string;
  /** When each side removed the conversation from their inbox, if they have. */
  buyerHiddenAt?: Date;
  sellerHiddenAt?: Date;
  createdAt: Date;
};

type ConversationRow = {
  id: string;
  listing_id: string | null;
  lost_item_id: string | null;
  buyer_id: string;
  seller_id: string;
  buyer_name: string | null;
  buyer_avatar_url: string | null;
  buyer_hidden_at?: string | null;
  seller_hidden_at?: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const CONVERSATION_COLUMNS =
  'id,listing_id,lost_item_id,buyer_id,seller_id,buyer_name,buyer_avatar_url,buyer_hidden_at,seller_hidden_at,created_at';
// Without the hidden-at columns, so chats still open against a database where
// 20260923090000_hide_conversations.sql has not been run yet.
const LEGACY_CONVERSATION_COLUMNS = CONVERSATION_COLUMNS.replace('buyer_hidden_at,seller_hidden_at,', '');
const MESSAGE_COLUMNS = 'id,conversation_id,sender_id,body,created_at';

type QueryResult = PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

/** Runs a conversations query, retrying without the newer columns on 42703 (undefined column). */
async function withConversationColumns(run: (columns: string) => QueryResult) {
  const result = await run(CONVERSATION_COLUMNS);
  return result.error?.code === '42703' ? run(LEGACY_CONVERSATION_COLUMNS) : result;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    listingId: row.listing_id ?? undefined,
    lostItemId: row.lost_item_id ?? undefined,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    buyerName: row.buyer_name ?? undefined,
    buyerAvatarUrl: row.buyer_avatar_url ?? undefined,
    buyerHiddenAt: row.buyer_hidden_at ? new Date(row.buyer_hidden_at) : undefined,
    sellerHiddenAt: row.seller_hidden_at ? new Date(row.seller_hidden_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

/** When this user removed the conversation from their inbox, if they have. */
export function hiddenAtFor(conversation: Conversation, userId: string) {
  return conversation.buyerId === userId ? conversation.buyerHiddenAt : conversation.sellerHiddenAt;
}

/**
 * Whether the conversation stays out of this user's inbox: they removed it and
 * nothing has been written since. A new message brings it back.
 */
export function isHiddenFor(conversation: Conversation, userId: string, latest: Message | null | undefined) {
  const hiddenAt = hiddenAtFor(conversation, userId);
  return !!hiddenAt && (!latest || latest.sentAt.getTime() <= hiddenAt.getTime());
}

function mapMessage(row: MessageRow, userId: string): Message {
  return {
    id: row.id,
    text: row.body,
    senderId: row.sender_id,
    fromMe: row.sender_id === userId,
    sentAt: new Date(row.created_at),
  };
}

/** Buyer-side entry point: fetches the buyer's conversation for a listing, creating it on first contact. */
export async function getOrCreateConversation(
  listingId: string,
  buyerId: string,
  buyerName?: string | null,
  buyerAvatarUrl?: string | null,
): Promise<Conversation> {
  const { data: existing, error: fetchError } = await withConversationColumns((columns) =>
    supabase.from('conversations').select(columns).eq('listing_id', listingId).eq('buyer_id', buyerId).maybeSingle(),
  );

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (existing) {
    return mapConversation(existing as ConversationRow);
  }

  // A failed RETURNING rolls the insert back, so the retry cannot duplicate it.
  const { data: created, error: insertError } = await withConversationColumns((columns) =>
    supabase
      .from('conversations')
      .insert({
        listing_id: listingId,
        buyer_id: buyerId,
        buyer_name: buyerName ?? null,
        buyer_avatar_url: buyerAvatarUrl ?? null,
      })
      .select(columns)
      .single(),
  );

  if (insertError) {
    // 23W05 comes from enforce_conversation_limits() in 20260916120000_content_limits.sql.
    if (insertError.code === '23W05') throw new ConversationRateLimitError(insertError.message);
    throw new Error(insertError.message);
  }

  return mapConversation(created as ConversationRow);
}

/** Seller-side (or reopen) entry point: fetches a known conversation by id. */
/**
 * The lost-and-found counterpart of getOrCreateConversation. seller_id is set
 * by a trigger from the post's owner, so the caller cannot pick who it reaches.
 */
export async function getOrCreateLostItemConversation(
  lostItemId: string,
  starterId: string,
  starterName?: string | null,
  starterAvatarUrl?: string | null,
): Promise<Conversation> {
  const { data: existing, error: fetchError } = await withConversationColumns((columns) =>
    supabase.from('conversations').select(columns).eq('lost_item_id', lostItemId).eq('buyer_id', starterId).maybeSingle(),
  );

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (existing) {
    return mapConversation(existing as ConversationRow);
  }

  const { data: created, error: insertError } = await withConversationColumns((columns) =>
    supabase
      .from('conversations')
      .insert({
        lost_item_id: lostItemId,
        buyer_id: starterId,
        buyer_name: starterName ?? null,
        buyer_avatar_url: starterAvatarUrl ?? null,
      })
      .select(columns)
      .single(),
  );

  if (insertError) {
    if (insertError.code === '23W05') throw new ConversationRateLimitError(insertError.message);
    throw new Error(insertError.message);
  }

  return mapConversation(created as ConversationRow);
}

export async function fetchConversation(conversationId: string): Promise<Conversation> {
  const { data, error } = await withConversationColumns((columns) =>
    supabase.from('conversations').select(columns).eq('id', conversationId).single(),
  );

  if (error) {
    throw new Error(error.message);
  }

  return mapConversation(data as ConversationRow);
}

export async function fetchConversationsForListing(listingId: string): Promise<Conversation[]> {
  const { data, error } = await withConversationColumns((columns) =>
    supabase.from('conversations').select(columns).eq('listing_id', listingId).order('created_at', { ascending: true }),
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ConversationRow[]).map(mapConversation);
}

export async function fetchConversationsForUser(userId: string): Promise<Conversation[]> {
  const { data, error } = await withConversationColumns((columns) =>
    supabase
      .from('conversations')
      .select(columns)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false }),
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ConversationRow[]).map(mapConversation);
}

/** Messages in a conversation, oldest first; only those after `since` when given. */
export async function fetchMessages(conversationId: string, userId: string, since?: Date): Promise<Message[]> {
  let query = supabase.from('messages').select(MESSAGE_COLUMNS).eq('conversation_id', conversationId);
  if (since) query = query.gt('created_at', since.toISOString());

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapMessage(row as MessageRow, userId));
}

/**
 * Latest message per conversation, for the inbox previews. One row per
 * conversation from the database (see 20260926120000_latest_messages.sql)
 * rather than every message the caller has ever been part of.
 */
export async function fetchLatestMessages(
  conversationIds: string[],
  userId: string,
): Promise<Map<string, Message>> {
  if (conversationIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc('latest_messages');

  // 42883/PGRST202: the function is missing, i.e. the migration has not been
  // run yet. The old way still works, it just reads far more than it needs.
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      return fetchLatestMessagesWithoutRpc(conversationIds, userId);
    }
    throw new Error(error.message);
  }

  const wanted = new Set(conversationIds);
  const latest = new Map<string, Message>();
  for (const row of (data ?? []) as MessageRow[]) {
    if (wanted.has(row.conversation_id)) {
      latest.set(row.conversation_id, mapMessage(row, userId));
    }
  }
  return latest;
}

async function fetchLatestMessagesWithoutRpc(
  conversationIds: string[],
  userId: string,
): Promise<Map<string, Message>> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latest = new Map<string, Message>();
  for (const row of (data ?? []) as MessageRow[]) {
    if (!latest.has(row.conversation_id)) {
      latest.set(row.conversation_id, mapMessage(row, userId));
    }
  }
  return latest;
}

/**
 * Removes a conversation from this user's inbox. The other person keeps it;
 * see 20260923090000_hide_conversations.sql for when it is deleted for good.
 */
export async function hideConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('hide_conversation', { target_conversation_id: conversationId });
  if (error) throw new Error(error.message);
}

/** Raised when the rate-limit trigger in the database rejects a message. */
export class MessageRateLimitError extends Error {}

/** Raised when the buyer has opened too many new conversations in an hour. */
export class ConversationRateLimitError extends Error {}

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: text })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) {
    // P0001 is enforce_message_rate_limit() saying the sender is going too
    // fast — worth telling them apart from "the message didn't go through".
    if (error.code === 'P0001') throw new MessageRateLimitError(error.message);
    throw new Error(error.message);
  }

  return mapMessage(data as MessageRow, senderId);
}

/** Subscribes to new messages in a conversation; returns an unsubscribe function. */
export function subscribeToMessages(
  conversationId: string,
  userId: string,
  onInsert: (message: Message) => void,
): () => void {
  const topic = `messages:${conversationId}`;
  const existingChannel = supabase.getChannels().find((ch) => ch.topic === `realtime:${topic}`);
  if (existingChannel) {
    supabase.removeChannel(existingChannel);
  }

  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(mapMessage(payload.new as MessageRow, userId)),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
