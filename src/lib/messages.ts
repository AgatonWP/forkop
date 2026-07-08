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
  listingId: string;
  buyerId: string;
  sellerId: string;
};

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

const CONVERSATION_COLUMNS = 'id,listing_id,buyer_id,seller_id';
const MESSAGE_COLUMNS = 'id,conversation_id,sender_id,text,created_at';

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
  };
}

function mapMessage(row: MessageRow, userId: string): Message {
  return {
    id: row.id,
    text: row.text,
    senderId: row.sender_id,
    fromMe: row.sender_id === userId,
    sentAt: new Date(row.created_at),
  };
}

/** Buyer-side entry point: fetches the buyer's conversation for a listing, creating it on first contact. */
export async function getOrCreateConversation(listingId: string, buyerId: string): Promise<Conversation> {
  const { data: existing, error: fetchError } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (existing) {
    return mapConversation(existing as ConversationRow);
  }

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: buyerId })
    .select(CONVERSATION_COLUMNS)
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return mapConversation(created as ConversationRow);
}

/** Seller-side (or reopen) entry point: fetches a known conversation by id. */
export async function fetchConversation(conversationId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', conversationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapConversation(data as ConversationRow);
}

export async function fetchConversationsForUser(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapConversation(row as ConversationRow));
}

export async function fetchMessages(conversationId: string, userId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapMessage(row as MessageRow, userId));
}

/** Latest message per conversation, for inbox previews. */
export async function fetchLatestMessages(
  conversationIds: string[],
  userId: string,
): Promise<Map<string, Message>> {
  if (conversationIds.length === 0) return new Map();

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

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) {
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
  const channel = supabase
    .channel(`messages:${conversationId}`)
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
