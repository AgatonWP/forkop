import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatModal } from '@/components/chat-modal';
import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  Conversation,
  Message,
  fetchConversationsForUser,
  fetchLatestMessages,
} from '@/lib/messages';
import { getNation } from '@/lib/nations';
import { Listing, fetchListingsByIds, formatRelativeTime } from '@/lib/tickets';

type InboxItem = {
  conversation: Conversation;
  listing: Listing;
  lastMessage: Message | null;
  isSeller: boolean;
};

export default function MessagesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { initializing, user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openItem, setOpenItem] = useState<InboxItem | null>(null);

  const loadInbox = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    setError(null);

    try {
      const conversations = await fetchConversationsForUser(user.id);
      const listingIds = [...new Set(conversations.map((c) => c.listingId))];
      const [listings, latestByConversation] = await Promise.all([
        fetchListingsByIds(listingIds),
        fetchLatestMessages(conversations.map((c) => c.id), user.id),
      ]);

      const listingById = new Map(listings.map((listing) => [listing.id, listing]));

      const nextItems = conversations
        .map((conversation): InboxItem | null => {
          const listing = listingById.get(conversation.listingId);
          if (!listing) return null;

          return {
            conversation,
            listing,
            lastMessage: latestByConversation.get(conversation.id) ?? null,
            isSeller: conversation.sellerId === user.id,
          };
        })
        .filter((item): item is InboxItem => item !== null)
        .sort((a, b) => {
          const aTime = a.lastMessage?.sentAt.getTime() ?? Number.POSITIVE_INFINITY;
          const bTime = b.lastMessage?.sentAt.getTime() ?? Number.POSITIVE_INFINITY;
          return bTime - aTime;
        });

      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta meddelanden.');
    }
  }, [user]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setItems([]);
      return;
    }

    setLoading(true);
    loadInbox().finally(() => setLoading(false));
  }, [initializing, user, loadInbox]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadInbox().finally(() => setRefreshing(false));
  }, [loadInbox]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <ThemedText style={styles.headerTitle}>Meddelanden</ThemedText>
        </View>
      </SafeAreaView>

      {!initializing && !user ? (
        <View style={styles.centerNotice}>
          <ThemedText type="small" themeColor="textSecondary">
            Logga in för att se dina meddelanden.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.conversation.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textSecondary} colors={['#1D2430']} />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
          ]}
          renderItem={({ item }) => <InboxRow item={item} onPress={() => setOpenItem(item)} />}
          ListEmptyComponent={
            (initializing || loading) ? (
              <View style={styles.centerNotice}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
              </View>
            ) : (
              <View style={styles.centerNotice}>
                <ThemedText style={styles.emptyTitle}>Inga meddelanden än</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                  {error ?? 'Kontakta en säljare från en annons för att starta en chatt.'}
                </ThemedText>
              </View>
            )
          }
        />
      )}

      <ChatModal
        listing={openItem?.listing ?? null}
        conversationId={openItem?.conversation.id}
        onClose={() => setOpenItem(null)}
      />
    </ThemedView>
  );
}

function InboxRow({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const theme = useTheme();
  const nationName = getNation(item.listing.nationId).name;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, opacity: pressed ? 0.72 : 1 },
      ]}>
      <NationEmblem nationId={item.listing.nationId} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <ThemedText numberOfLines={1} style={styles.rowTitle}>
            {item.listing.eventName}
          </ThemedText>
          <View style={[styles.roleBadge, item.isSeller ? styles.roleBadgeSeller : styles.roleBadgeBuyer]}>
            <ThemedText style={styles.roleBadgeText}>{item.isSeller ? 'Säljare' : 'Köpare'}</ThemedText>
          </View>
        </View>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
          {item.lastMessage ? item.lastMessage.text : `${nationName} · Ingen chatt ännu`}
        </ThemedText>
      </View>
      {item.lastMessage && (
        <ThemedText type="small" themeColor="textSecondary">
          {formatRelativeTime(item.lastMessage.sentAt)}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  headerTitle: {
    color: '#1D2430',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  listContent: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    width: '100%',
  },
  centerNotice: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 68,
    padding: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeSeller: {
    backgroundColor: '#EAF0FF',
  },
  roleBadgeBuyer: {
    backgroundColor: '#FFC8A54D',
  },
  roleBadgeText: {
    color: '#1D2430',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
