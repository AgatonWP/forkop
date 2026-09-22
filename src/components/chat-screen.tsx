import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ReportModal } from '@/components/report-modal';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { blockUser, getBlockStatus, unblockUser } from '@/lib/blocking';
import { clearDraft, linkDraftKey, readDraft, saveDraft } from '@/lib/chat-drafts';
import { useI18n } from '@/lib/i18n';
import { LostItem } from '@/lib/lost-items';
import {
  Conversation,
  ConversationRateLimitError,
  Message,
  MessageRateLimitError,
  fetchMessages,
  hiddenAtFor,
  hideConversation,
  sendMessage,
  subscribeToMessages,
} from '@/lib/messages';
import { Listing } from '@/lib/tickets';
import { useUnreadMessages } from '@/lib/unread-messages';

/** Matches the check constraint on messages.body. */
const MAX_MESSAGE_LENGTH = 2000;

export type ChatMenuAction = { text: string; onPress: () => void };

type Props = {
  /**
   * What the chat is about. A new key opens a different chat; null closes it.
   * The listing id or lost item id, which also keys the unsent draft until
   * the conversation id is known.
   */
  chatKey: string | null;
  /** Opens (or creates) the conversation. Read when chatKey changes. */
  loadConversation: () => Promise<Conversation>;
  onClose: () => void;
  /** Tells the caller which conversation loaded, e.g. to show the other name. */
  onConversation?: (conversation: Conversation | null) => void;
  /** After this user removed the conversation from their inbox. */
  onHidden?: (conversationId: string) => void;
  header: {
    name: string;
    avatarUrl?: string;
    /** Next to the name, e.g. the verified-organizer badge. */
    nameAccessory?: ReactNode;
    /** What the chat is about, under the name. */
    subtitle: string;
    subtitleAccessory?: ReactNode;
  };
  /** A bar under the header, e.g. Swish. Hidden while messaging is blocked. */
  banner?: ReactNode;
  /** Put first in the ⋯ menu, e.g. "Markera som såld". */
  menuActions?: ChatMenuAction[];
  menuBusy?: boolean;
  report: { listing?: Listing | null; lostItem?: LostItem | null };
  /** Extra modals that belong to the chat, e.g. rating after a sale. */
  children?: ReactNode;
};

/**
 * The chat itself, shared by ticket listings (ChatModal) and lost items
 * (LostItemChatModal) so the two look and behave the same: full screen, swipe
 * right to go back, drafts kept per chat, and report, block and remove in the
 * ⋯ menu. What differs — the header's subject line, Swish, marking a listing
 * sold — comes in through props.
 */
export function ChatScreen({
  chatKey,
  loadConversation,
  onClose,
  onConversation,
  onHidden,
  header,
  banner,
  menuActions = [],
  menuBusy = false,
  report,
  children,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const { markConversationRead, refresh: refreshUnread } = useUnreadMessages();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [interactionBlocked, setInteractionBlocked] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const listRef = useRef<FlatList>(null);
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  // The latest callbacks, without making the load effect depend on them: the
  // chat reloads when chatKey changes, not whenever a parent re-renders.
  const loadRef = useRef(loadConversation);
  const onConversationRef = useRef(onConversation);
  useEffect(() => {
    loadRef.current = loadConversation;
    onConversationRef.current = onConversation;
  });

  useEffect(() => {
    setDraft(chatKey ? readDraft(chatKey) : '');
    screenTranslateX.setValue(0);
  }, [chatKey, screenTranslateX]);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (chatKey) saveDraft(chatKey, value);
    },
    [chatKey],
  );

  useEffect(() => {
    if (!chatKey || !user) return;

    let active = true;
    setLoading(true);
    setLoadError(null);
    setConversation(null);
    setMessages([]);
    onConversationRef.current?.(null);

    loadRef
      .current()
      .then(async (conv) => {
        if (!active) return;
        linkDraftKey(chatKey, conv.id);
        setConversation(conv);
        onConversationRef.current?.(conv);
        // After removing a conversation you see only what came since, as in
        // any messaging app; the history is still there for the other person.
        const msgs = await fetchMessages(conv.id, user.id, hiddenAtFor(conv, user.id));
        if (!active) return;
        setMessages(msgs);
        markConversationRead(conv.id);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof ConversationRateLimitError ? t('chatStartRateLimited') : t('chatLoadError'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chatKey, user, markConversationRead, t]);

  useEffect(() => {
    if (!conversation || !user) {
      setBlockedByMe(false);
      setInteractionBlocked(false);
      return;
    }

    let active = true;
    const otherUserId = conversation.sellerId === user.id ? conversation.buyerId : conversation.sellerId;

    getBlockStatus(otherUserId)
      .then((status) => {
        if (!active) return;
        setBlockedByMe(status.blockedByMe);
        setInteractionBlocked(status.interactionBlocked);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [conversation, user]);

  useEffect(() => {
    if (!conversation || !user) return;

    return subscribeToMessages(conversation.id, user.id, (message) => {
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      markConversationRead(conversation.id);
    });
  }, [conversation, user, markConversationRead]);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(scrollToBottom, 50);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!conversation || !user || !draft.trim() || sending) return;

    const text = draft.trim();
    setSending(true);
    setSendError(null);

    try {
      const message = await sendMessage(conversation.id, user.id, text);
      setDraft('');
      if (chatKey) clearDraft(chatKey);
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    } catch (error) {
      setSendError(error instanceof MessageRateLimitError ? t('chatRateLimited') : t('chatSendError'));
    } finally {
      setSending(false);
    }
  }, [conversation, user, draft, chatKey, sending, t]);

  const handleToggleBlock = useCallback(async () => {
    if (!conversation || !user || blockSubmitting) return;

    const otherUserId = conversation.sellerId === user.id ? conversation.buyerId : conversation.sellerId;
    setBlockSubmitting(true);
    setSendError(null);

    try {
      if (blockedByMe) {
        await unblockUser(user.id, otherUserId);
        const status = await getBlockStatus(otherUserId);
        setBlockedByMe(status.blockedByMe);
        setInteractionBlocked(status.interactionBlocked);
      } else {
        await blockUser(user.id, otherUserId);
        setBlockedByMe(true);
        setInteractionBlocked(true);
      }
    } catch {
      setSendError(t('blockUserError'));
    } finally {
      setBlockSubmitting(false);
    }
  }, [blockedByMe, blockSubmitting, conversation, t, user]);

  const handleHide = useCallback(() => {
    if (!conversation) return;

    Alert.alert(t('deleteConversationTitle'), t('deleteConversationMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await hideConversation(conversation.id);
            if (chatKey) clearDraft(chatKey);
            refreshUnread();
            onHidden?.(conversation.id);
            onClose();
          } catch {
            setSendError(t('deleteConversationError'));
          }
        },
      },
    ]);
  }, [chatKey, conversation, onClose, onHidden, refreshUnread, t]);

  const openMenu = useCallback(() => {
    if (!conversation || !user) {
      setReportOpen(true);
      return;
    }

    const options: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
      ...menuActions,
      { text: t('reportUser'), onPress: () => setReportOpen(true) },
      {
        text: blockedByMe ? t('unblockUser') : t('blockUser'),
        style: blockedByMe ? 'default' : 'destructive',
        onPress: () => {
          if (blockedByMe) {
            handleToggleBlock();
            return;
          }

          Alert.alert(t('blockUser'), t('blockUserConfirmation'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('blockUser'), style: 'destructive', onPress: handleToggleBlock },
          ]);
        },
      },
      { text: t('deleteConversation'), style: 'destructive', onPress: handleHide },
      { text: t('cancel'), style: 'cancel' },
    ];

    Alert.alert(t('safetyActions'), undefined, options);
  }, [blockedByMe, conversation, handleHide, handleToggleBlock, menuActions, t, user]);

  const closeFromSwipe = useCallback(() => {
    Animated.timing(screenTranslateX, {
      toValue: Dimensions.get('window').width,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      screenTranslateX.setValue(0);
      onClose();
    });
  }, [onClose, screenTranslateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          screenTranslateX.setValue(Math.max(0, gesture.dx));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 100 || gesture.vx > 1.1) {
            closeFromSwipe();
            return;
          }

          Animated.spring(screenTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(screenTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
      }),
    [closeFromSwipe, screenTranslateX],
  );

  if (!chatKey) return null;

  return (
    <Modal animationType="slide" visible onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            transform: [{ translateX: screenTranslateX }],
          },
        ]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.backgroundHeader,
              borderBottomColor: theme.backgroundSelected,
              paddingTop: insets.top + Spacing.one,
            },
          ]}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}>
            <ThemedText style={styles.backIcon}>‹</ThemedText>
          </Pressable>
          {header.avatarUrl ? (
            <Image contentFit="cover" source={{ uri: header.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.headerAvatarFallbackText} themeColor="textSecondary">
                {header.name[0]?.toUpperCase() ?? '?'}
              </ThemedText>
            </View>
          )}
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <ThemedText numberOfLines={1} style={styles.headerTitle}>
                {header.name}
              </ThemedText>
              {header.nameAccessory}
            </View>
            <View style={styles.headerMetaRow}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.headerMetaText}>
                {header.subtitle}
              </ThemedText>
              {header.subtitleAccessory}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              accessibilityLabel={t('safetyActions')}
              disabled={blockSubmitting || menuBusy}
              hitSlop={8}
              onPress={openMenu}
              style={styles.moreButton}>
              <ThemedText style={styles.moreIcon}>⋯</ThemedText>
            </Pressable>
          </View>
        </View>

        {!interactionBlocked && banner}

        <View style={styles.flex}>
          {!user ? (
            <View style={styles.centerNotice}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('chatLoginRequired')}
              </ThemedText>
            </View>
          ) : loading ? (
            <View style={styles.centerNotice}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : loadError ? (
            <View style={styles.centerNotice}>
              <ThemedText type="small" themeColor="textSecondary">
                {loadError}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={[
                styles.messageList,
                { paddingBottom: keyboardHeight + insets.bottom + 96 },
              ]}
              onContentSizeChange={scrollToBottom}
              renderItem={({ item, index }) => (
                <MessageBubble
                  message={item}
                  showDate={
                    index === 0 ||
                    messages[index - 1].sentAt.getMinutes() !== item.sentAt.getMinutes()
                  }
                />
              )}
              ListEmptyComponent={
                <View style={styles.centerNotice}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('chatEmpty')}
                  </ThemedText>
                </View>
              }
            />
          )}

          {user && !loading && !loadError && interactionBlocked && (
            <View
              style={[
                styles.blockedNotice,
                { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.blockedNoticeText}>
                {t('blockedConversation')}
              </ThemedText>
              {blockedByMe && (
                <Pressable disabled={blockSubmitting} onPress={handleToggleBlock}>
                  <ThemedText style={styles.unblockAction}>{t('unblockUser')}</ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {user && !loading && !loadError && !interactionBlocked && (
            <View
              style={[
                styles.inputBar,
                {
                  backgroundColor: theme.backgroundElement,
                  borderTopColor: theme.backgroundSelected,
                  bottom: keyboardHeight,
                  paddingBottom: keyboardHeight > 0 ? Spacing.two : insets.bottom + Spacing.two,
                },
              ]}>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={handleDraftChange}
                  placeholder={t('writeMessage')}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={MAX_MESSAGE_LENGTH}
                  multiline
                  submitBehavior="submit"
                  editable={!sending}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                    },
                  ]}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <Pressable
                  accessibilityLabel={t('send')}
                  onPress={handleSend}
                  disabled={sending}
                  style={[styles.sendButton, { opacity: draft.trim() && !sending ? 1 : 0.3 }]}>
                  <ThemedText style={styles.sendIcon}>↑</ThemedText>
                </Pressable>
              </View>
              {sendError && <ThemedText style={styles.sendErrorText}>{sendError}</ThemedText>}
            </View>
          )}
        </View>
      </Animated.View>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        listing={report.listing}
        lostItem={report.lostItem}
        mode="chat"
      />

      {children}
    </Modal>
  );
}

function MessageBubble({ message, showDate }: { message: Message; showDate: boolean }) {
  const theme = useTheme();
  const time = message.sentAt.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.bubbleRow, message.fromMe && styles.bubbleRowMe]}>
      <View
        style={[
          styles.bubble,
          message.fromMe
            ? styles.bubbleMe
            : [styles.bubbleThem, { backgroundColor: theme.backgroundElement }],
        ]}>
        <ThemedText style={[styles.bubbleText, message.fromMe && styles.bubbleTextMe]}>
          {message.text}
        </ThemedText>
      </View>
      {showDate && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={[styles.timestamp, message.fromMe && styles.timestampMe]}>
          {time}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },

  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 34,
  },
  headerAvatar: {
    borderRadius: 16,
    height: 32,
    marginRight: Spacing.two,
    width: 32,
  },
  headerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarFallbackText: {
    fontSize: 13,
    fontWeight: '800',
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  headerMetaText: {
    flexShrink: 1,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  moreButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 24,
  },
  moreIcon: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 20,
  },

  centerNotice: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },

  messageList: {
    flexGrow: 1,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },

  bubbleRow: {
    alignItems: 'flex-start',
    gap: 3,
    marginBottom: Spacing.one,
  },
  bubbleRowMe: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
    maxWidth: '78%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleMe: {
    backgroundColor: '#1D2430',
    borderBottomRightRadius: 5,
  },
  bubbleThem: {
    borderBottomLeftRadius: 5,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    marginHorizontal: Spacing.two,
  },
  timestampMe: {
    textAlign: 'right',
  },

  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blockedNotice: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    gap: Spacing.one,
    left: 0,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    position: 'absolute',
    right: 0,
  },
  blockedNoticeText: {
    textAlign: 'center',
  },
  unblockAction: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  sendErrorText: {
    color: '#C84646',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: Spacing.one,
  },
});
