import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatModal } from '@/components/chat-modal';
import { LostItemChatModal } from '@/components/lost-item-chat-modal';
import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, SecondaryHeaderHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  Conversation,
  Message,
  fetchConversationsForUser,
  fetchLatestMessages,
  hideConversation,
  isHiddenFor,
} from '@/lib/messages';
import {
  LOST_ITEM_CATEGORY_EMOJI,
  LostItem,
  fetchLostItemsByIds,
  lostItemTitle,
} from '@/lib/lost-items';
import { Listing, conversationRoles, fetchListingsByIds, formatRelativeTime } from '@/lib/tickets';
import { useUnreadMessages } from '@/lib/unread-messages';

/** A conversation is about a ticket listing or about a lost item, never both. */
type InboxSubject =
  | { kind: 'listing'; listing: Listing }
  | { kind: 'lostItem'; lostItem: LostItem };

type InboxItem = {
  conversation: Conversation;
  subject: InboxSubject;
  lastMessage: Message | null;
  /** Owns the post the conversation is about — not the same as being the seller. */
  isOwner: boolean;
};

export default function MessagesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { initializing, user } = useAuth();
  const { t } = useI18n();
  const { unreadConversationIds, refresh: refreshUnreadMessages } = useUnreadMessages();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openItem, setOpenItem] = useState<InboxItem | null>(null);
  // Picking several conversations to remove at once. Empty set and off means
  // the list behaves as usual; a tap opens a chat.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const loadInbox = useCallback(async (isActive: () => boolean = () => true) => {
    if (!user) {
      if (isActive()) setItems([]);
      return;
    }

    if (isActive()) setError(null);

    try {
      const conversations = await fetchConversationsForUser(user.id);
      const listingIds = [...new Set(conversations.map((c) => c.listingId).filter(Boolean) as string[])];
      const lostItemIds = [...new Set(conversations.map((c) => c.lostItemId).filter(Boolean) as string[])];
      const [listings, lostItems, latestByConversation] = await Promise.all([
        fetchListingsByIds(listingIds),
        fetchLostItemsByIds(lostItemIds),
        fetchLatestMessages(conversations.map((c) => c.id), user.id),
      ]);

      const listingById = new Map(listings.map((listing) => [listing.id, listing]));
      const lostItemById = new Map(lostItems.map((item) => [item.id, item]));

      const nextItems = conversations
        .map((conversation): InboxItem | null => {
          const listing = conversation.listingId ? listingById.get(conversation.listingId) : undefined;
          const lostItem = conversation.lostItemId ? lostItemById.get(conversation.lostItemId) : undefined;
          const subject: InboxSubject | null = listing
            ? { kind: 'listing', listing }
            : lostItem
              ? { kind: 'lostItem', lostItem }
              : null;
          if (!subject) return null;

          return {
            conversation,
            subject,
            lastMessage: latestByConversation.get(conversation.id) ?? null,
            isOwner: conversation.sellerId === user.id,
          };
        })
        .filter(
          (item): item is InboxItem =>
            item !== null &&
            item.lastMessage !== null &&
            !isHiddenFor(item.conversation, user.id, item.lastMessage),
        )
        .sort((a, b) => {
          const aTime = a.lastMessage?.sentAt.getTime() ?? a.conversation.createdAt.getTime();
          const bTime = b.lastMessage?.sentAt.getTime() ?? b.conversation.createdAt.getTime();
          return bTime - aTime;
        });

      if (!isActive()) return;
      setItems(nextItems);
    } catch {
      if (!isActive()) return;
      setError(t('messagesFetchError'));
    }
  }, [t, user]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setItems([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    loadInbox(() => isMounted).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [initializing, user, loadInbox]);

  // unreadConversationIds changes whenever a new message arrives anywhere (or
  // gets marked read), via the global realtime subscription in
  // UnreadMessagesProvider. Reloading here keeps the inbox order live while
  // this screen stays open, instead of only on mount/focus.
  useEffect(() => {
    if (initializing || !user) return;
    loadInbox();
  }, [unreadConversationIds, initializing, user, loadInbox]);

  // Tab screens stay mounted when you switch away, so refresh the inbox
  // whenever Messages becomes visible again.
  useFocusEffect(
    useCallback(() => {
      if (initializing) return;

      let isActive = true;

      if (user) {
        loadInbox(() => isActive);
        refreshUnreadMessages();
      } else {
        setItems([]);
      }

      return () => {
        isActive = false;
      };
    }, [initializing, loadInbox, refreshUnreadMessages, user]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadInbox().finally(() => setRefreshing(false));
  }, [loadInbox]);
  const removeFromInbox = useCallback((conversationId: string) => {
    setItems((current) => current.filter((item) => item.conversation.id !== conversationId));
  }, []);

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback((conversationId: string) => {
    setSelectedIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId],
    );
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0 || deleting) return;

    const single = selectedIds.length === 1;

    Alert.alert(
      single ? t('deleteConversationTitle') : t('deleteConversationsTitle'),
      single ? t('deleteConversationMessage') : t('deleteConversationsMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await Promise.all(selectedIds.map((id) => hideConversation(id)));
              setItems((current) => current.filter((item) => !selectedIds.includes(item.conversation.id)));
              refreshUnreadMessages();
              stopSelecting();
            } catch {
              Alert.alert(t('deleteConversationError'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [deleting, refreshUnreadMessages, selectedIds, stopSelecting, t]);

  // Long press, like in most messaging apps. The same choice is in the ⋯ menu
  // inside the chat.
  const confirmHide = useCallback(
    (item: InboxItem) => {
      Alert.alert(t('deleteConversationTitle'), t('deleteConversationMessage'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await hideConversation(item.conversation.id);
              removeFromInbox(item.conversation.id);
              refreshUnreadMessages();
            } catch {
              Alert.alert(t('deleteConversationError'));
            }
          },
        },
      ]);
    },
    [refreshUnreadMessages, removeFromInbox, t],
  );

  const unreadConversationIdSet = useMemo(
    () => new Set(unreadConversationIds),
    [unreadConversationIds],
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <ThemedText style={styles.headerTitle}>{t('messages')}</ThemedText>
          {/* The tick turns the list into one you tick things off in, and
              turns back into Avbryt while you are picking. */}
          {selecting ? (
            <Pressable hitSlop={12} onPress={stopSelecting} style={styles.headerAction}>
              <ThemedText style={styles.headerActionText}>{t('cancel')}</ThemedText>
            </Pressable>
          ) : (
            items.length > 0 && (
              <Pressable
                accessibilityLabel={t('selectConversations')}
                hitSlop={12}
                onPress={() => setSelecting(true)}
                style={styles.headerAction}>
                <Ionicons color={theme.text} name="checkmark-circle-outline" size={24} />
              </Pressable>
            )
          )}
        </View>
      </SafeAreaView>

      {!initializing && !user ? (
        <View style={styles.centerNotice}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('messagesLoginRequired')}
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
            // Room for the delete bar while picking, so the last row stays reachable.
            { paddingBottom: insets.bottom + BottomTabInset + (selecting ? 80 : Spacing.four) },
          ]}
          renderItem={({ item }) => (
            <InboxRow
              item={item}
              isUnread={unreadConversationIdSet.has(item.conversation.id)}
              selecting={selecting}
              selected={selectedIds.includes(item.conversation.id)}
              onPress={() => (selecting ? toggleSelected(item.conversation.id) : setOpenItem(item))}
              onLongPress={() => {
                if (selecting) return;
                confirmHide(item);
              }}
            />
          )}
          ListEmptyComponent={
            (initializing || loading) ? (
              <View style={styles.centerNotice}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
              </View>
            ) : (
              <View style={styles.centerNotice}>
                <ThemedText style={styles.emptyTitle}>{t('noMessagesYet')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                  {error ?? t('startChatHint')}
                </ThemedText>
              </View>
            )
          }
        />
      )}

      {selecting && (
        <View
          style={[
            styles.deleteBar,
            {
              backgroundColor: theme.backgroundHeader,
              borderTopColor: theme.backgroundSelected,
              paddingBottom: insets.bottom + BottomTabInset,
            },
          ]}>
          <Pressable
            disabled={selectedIds.length === 0 || deleting}
            onPress={deleteSelected}
            style={[styles.deleteButton, { opacity: selectedIds.length === 0 || deleting ? 0.45 : 1 }]}>
            {deleting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.deleteButtonText}>
                {selectedIds.length > 0 ? `${t('delete')} (${selectedIds.length})` : t('delete')}
              </ThemedText>
            )}
          </Pressable>
        </View>
      )}

      <ChatModal
        listing={openItem?.subject.kind === 'listing' ? openItem.subject.listing : null}
        conversationId={openItem?.conversation.id}
        onClose={() => setOpenItem(null)}
        onHidden={removeFromInbox}
        onListingSold={(soldListing) => {
          const replace = (item: InboxItem): InboxItem =>
            item.subject.kind === 'listing' && item.subject.listing.id === soldListing.id
              ? { ...item, subject: { kind: 'listing', listing: soldListing } }
              : item;

          setItems((current) => current.map(replace));
          setOpenItem((current) => (current ? replace(current) : current));
        }}
      />

      <LostItemChatModal
        item={openItem?.subject.kind === 'lostItem' ? openItem.subject.lostItem : null}
        conversationId={openItem?.conversation.id}
        onClose={() => setOpenItem(null)}
        onHidden={removeFromInbox}
        onResolved={(resolved) => {
          const replace = (item: InboxItem): InboxItem =>
            item.subject.kind === 'lostItem' && item.subject.lostItem.id === resolved.id
              ? { ...item, subject: { kind: 'lostItem', lostItem: resolved } }
              : item;

          setItems((current) => current.map(replace));
          setOpenItem((current) => (current ? replace(current) : current));
        }}
      />
    </ThemedView>
  );
}

function InboxRow({
  item,
  isUnread,
  selecting,
  selected,
  onPress,
  onLongPress,
}: {
  item: InboxItem;
  isUnread: boolean;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const subject = item.subject;
  const subjectLabel =
    subject.kind === 'listing'
      ? subject.listing.eventName
      : `${LOST_ITEM_CATEGORY_EMOJI[subject.lostItem.category]} ${lostItemTitle(subject.lostItem, t)}`;
  const ownerName =
    subject.kind === 'listing' ? subject.listing.sellerName : subject.lostItem.reporterName;
  const otherPartyName = item.isOwner
    ? (item.conversation.buyerName ?? t('buyer'))
    : (ownerName ?? t('seller'));
  // Buying and selling only mean something for tickets. On a wanted post the
  // owner is the buyer, so the role comes from conversationRoles(), not from
  // who owns the post.
  const role =
    subject.kind === 'listing' && user
      ? conversationRoles(subject.listing, item.conversation).sellerId === user.id
        ? 'seller'
        : 'buyer'
      : null;
  const nationId = subject.kind === 'listing' ? subject.listing.nationId : subject.lostItem.nationId;
  const closed =
    subject.kind === 'listing' ? !!subject.listing.isSold : subject.lostItem.status === 'resolved';
  const closedLabel = subject.kind === 'listing' ? t('sold') : t('lostResolvedBadge');
  const previewText = item.lastMessage
    ? `${subjectLabel} · ${item.lastMessage.text}`
    : `${subjectLabel} · ${t('noChatYet')}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        isUnread && styles.rowUnread,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: isUnread ? '#C84646' : theme.backgroundSelected,
          opacity: pressed ? 0.72 : closed ? 0.55 : 1,
        },
      ]}>
      {selecting && (
        <Ionicons
          color={selected ? '#1D2430' : theme.textSecondary}
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
        />
      )}
      <NationEmblem nationId={nationId} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <ThemedText numberOfLines={1} style={[styles.rowTitle, isUnread && styles.rowTitleUnread]}>
            {otherPartyName}
          </ThemedText>
          {role && (
            <View style={[styles.roleBadge, role === 'seller' ? styles.roleBadgeSeller : styles.roleBadgeBuyer]}>
              <ThemedText style={styles.roleBadgeText}>{role === 'seller' ? t('seller') : t('buyer')}</ThemedText>
            </View>
          )}
          {closed && (
            <View style={styles.soldBadge}>
              <ThemedText style={styles.soldBadgeText}>{closedLabel}</ThemedText>
            </View>
          )}
        </View>
        <ThemedText
          numberOfLines={1}
          type="small"
          themeColor={isUnread ? 'text' : 'textSecondary'}
          style={isUnread && styles.rowPreviewUnread}>
          {previewText}
        </ThemedText>
      </View>
      {item.lastMessage && (
        <View style={styles.rowMeta}>
          <ThemedText
            type="small"
            themeColor={isUnread ? 'text' : 'textSecondary'}
            style={isUnread && styles.rowTimeUnread}>
            {formatRelativeTime(item.lastMessage.sentAt)}
          </ThemedText>
          {isUnread && <View style={styles.rowUnreadDot} />}
        </View>
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
    justifyContent: 'center',
    minHeight: SecondaryHeaderHeight,
    paddingHorizontal: Spacing.three,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  headerAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 60,
    position: 'absolute',
    right: Spacing.three,
  },
  headerActionText: {
    color: '#4F6FB7',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    position: 'absolute',
    right: 0,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#C84646',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
  rowUnread: {
    borderWidth: 1.5,
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
  rowTitleUnread: {
    fontWeight: '900',
  },
  rowPreviewUnread: {
    fontWeight: '800',
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  rowTimeUnread: {
    fontWeight: '800',
  },
  rowUnreadDot: {
    backgroundColor: '#C84646',
    borderRadius: 999,
    height: 8,
    width: 8,
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
    backgroundColor: '#FFC8A5CC',
  },
  roleBadgeText: {
    color: '#1D2430',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  soldBadge: {
    backgroundColor: '#EEF0F4',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soldBadgeText: {
    color: '#687283',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
