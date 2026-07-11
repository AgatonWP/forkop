import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { fetchConversationsForUser, fetchLatestMessages } from '@/lib/messages';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'forkop-last-read';

const webStorage = {
  getItem: async (key: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: async (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

async function loadLastRead(): Promise<Record<string, string>> {
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

type UnreadMessagesContextValue = {
  hasUnread: boolean;
  unreadConversationCount: number;
  unreadConversationIds: string[];
  refresh: () => void;
  markConversationRead: (conversationId: string) => void;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | null>(null);

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>([]);
  const lastReadRef = useRef<Record<string, string>>({});
  const unreadConversationCount = unreadConversationIds.length;
  const hasUnread = unreadConversationCount > 0;

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadConversationIds([]);
      return;
    }

    try {
      const [lastRead, conversations] = await Promise.all([
        loadLastRead(),
        fetchConversationsForUser(user.id),
      ]);
      lastReadRef.current = lastRead;

      const latestByConversation = await fetchLatestMessages(
        conversations.map((c) => c.id),
        user.id,
      );

      const unread = conversations.flatMap((conversation) => {
        const latest = latestByConversation.get(conversation.id);
        if (!latest || latest.fromMe) return [];

        const readAt = lastRead[conversation.id];
        return !readAt || latest.sentAt.getTime() > new Date(readAt).getTime()
          ? [conversation.id]
          : [];
      });

      setUnreadConversationIds(unread);
    } catch {
      // A failed refresh just leaves the badge in its last known state.
    }
  }, [user]);

  const markConversationRead = useCallback(
    (conversationId: string) => {
      const next = { ...lastReadRef.current, [conversationId]: new Date().toISOString() };
      lastReadRef.current = next;
      setUnreadConversationIds((current) => current.filter((id) => id !== conversationId));
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      refresh();
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-messages-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const value = useMemo<UnreadMessagesContextValue>(
    () => ({ hasUnread, unreadConversationCount, unreadConversationIds, refresh, markConversationRead }),
    [hasUnread, unreadConversationCount, unreadConversationIds, refresh, markConversationRead],
  );

  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);

  if (!context) {
    throw new Error('useUnreadMessages must be used inside UnreadMessagesProvider');
  }

  return context;
}
