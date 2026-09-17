import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { blockUser, getBlockStatus } from '@/lib/blocking';
import { useI18n } from '@/lib/i18n';
import {
  LOST_ITEM_CATEGORY_EMOJI,
  LOST_ITEM_CATEGORY_KEY,
  LostItem,
} from '@/lib/lost-items';
import {
  Conversation,
  ConversationRateLimitError,
  Message,
  MessageRateLimitError,
  fetchConversation,
  fetchMessages,
  getOrCreateLostItemConversation,
  sendMessage,
  subscribeToMessages,
} from '@/lib/messages';
import { getNation } from '@/lib/nations';
import { formatListingEventDate } from '@/lib/tickets';
import { useUnreadMessages } from '@/lib/unread-messages';

/** Matches the check constraint on messages.body. */
const MAX_MESSAGE_LENGTH = 2000;

type Props = {
  item: LostItem | null;
  /** Passed when opening from the inbox, where the conversation already exists. */
  conversationId?: string;
  onClose: () => void;
};

/**
 * Deliberately not ChatModal: that one carries price, Swish, "mark as sold" and
 * ratings, none of which mean anything for a jacket someone left behind. The
 * messages underneath are the same table, so the inbox, unread counts and push
 * notifications are shared.
 */
export function LostItemChatModal({ item, conversationId, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language, t } = useI18n();
  const { markConversationRead } = useUnreadMessages();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const promptedFor = useRef<string | null>(null);

  const isOwnPost = !!user && !!item && item.userId === user.id;

  useEffect(() => {
    if (!item || !user) return;

    let active = true;
    setLoading(true);
    setLoadError(null);
    setConversation(null);
    setMessages([]);

    const load = conversationId
      ? fetchConversation(conversationId)
      : getOrCreateLostItemConversation(
          item.id,
          user.id,
          user.user_metadata?.full_name ?? user.email?.split('@')[0],
          user.user_metadata?.avatar_url,
        );

    load
      .then(async (conv) => {
        if (!active) return;
        setConversation(conv);
        const existing = await fetchMessages(conv.id, user.id);
        if (!active) return;
        setMessages(existing);
        markConversationRead(conv.id);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof ConversationRateLimitError
            ? t('chatStartRateLimited')
            : t('chatLoadError'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [conversationId, item, markConversationRead, t, user]);

  useEffect(() => {
    if (!conversation || !user) return;
    return subscribeToMessages(conversation.id, user.id, (message) => {
      setMessages((current) =>
        current.some((existing) => existing.id === message.id) ? current : [...current, message],
      );
    });
  }, [conversation, user]);

  useEffect(() => {
    if (!item || !user || isOwnPost) return;

    getBlockStatus(item.userId)
      .then((status) => setBlocked(status.interactionBlocked))
      .catch(() => setBlocked(false));
  }, [isOwnPost, item, user]);

  // The claim is the whole point of the screen, so the first message starts
  // written: on a found item it asks for a detail only the owner would know,
  // which is what keeps someone from claiming a stranger's keys.
  useEffect(() => {
    if (!item || loading || messages.length > 0 || isOwnPost) return;
    if (promptedFor.current === item.id) return;

    promptedFor.current = item.id;
    setDraft(item.kind === 'found' ? t('lostClaimPrompt') : t('lostHavePrompt'));
  }, [isOwnPost, item, loading, messages.length, t]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!conversation || !user || !text || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const message = await sendMessage(conversation.id, user.id, text.slice(0, MAX_MESSAGE_LENGTH));
      setMessages((current) =>
        current.some((existing) => existing.id === message.id) ? current : [...current, message],
      );
      setDraft('');
    } catch (error) {
      setSendError(
        error instanceof MessageRateLimitError ? t('chatRateLimited') : t('chatSendError'),
      );
    } finally {
      setSending(false);
    }
  }, [conversation, draft, sending, t, user]);

  function handleBlock() {
    if (!item || !user || isOwnPost) return;

    Alert.alert(t('blockUser'), t('blockUserConfirmation'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('blockUser'),
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(user.id, item.userId);
            setBlocked(true);
          } catch {
            setSendError(t('blockUserError'));
          }
        },
      },
    ]);
  }

  const canSend = !!draft.trim() && !sending && !blocked;

  return (
    <Modal visible={!!item} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <ThemedView style={styles.screen}>
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.backgroundSelected, paddingTop: Spacing.three },
          ]}>
          <Pressable hitSlop={12} onPress={onClose} style={styles.headerButton}>
            <ThemedText style={styles.headerClose}>‹</ThemedText>
          </Pressable>

          <View style={styles.headerCopy}>
            <ThemedText numberOfLines={1} style={styles.headerTitle}>
              {item
                ? `${LOST_ITEM_CATEGORY_EMOJI[item.category]} ${t(LOST_ITEM_CATEGORY_KEY[item.category])}`
                : ''}
            </ThemedText>
            {item && (
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                {`${t(item.kind === 'found' ? 'lostSegmentFound' : 'lostSegmentLost')} · ${getNation(item.nationId).name} · ${formatListingEventDate(item.happenedOn, language)}`}
              </ThemedText>
            )}
          </View>

          {!isOwnPost && (
            <Pressable accessibilityLabel={t('blockUser')} hitSlop={12} onPress={handleBlock} style={styles.headerButton}>
              <Ionicons color={theme.textSecondary} name="ellipsis-horizontal" size={20} />
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Spacing.three}
          style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.textSecondary} size="small" />
            </View>
          ) : loadError ? (
            <View style={styles.center}>
              <ThemedText type="small" themeColor="textSecondary">
                {loadError}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.messageList}
              data={messages}
              keyExtractor={(message) => message.id}
              renderItem={({ item: message }) => (
                <View
                  style={[
                    styles.bubble,
                    message.fromMe
                      ? [styles.bubbleMine, { backgroundColor: '#1D2430' }]
                      : [styles.bubbleTheirs, { backgroundColor: theme.backgroundElement }],
                  ]}>
                  <ThemedText style={message.fromMe ? styles.bubbleTextMine : undefined}>
                    {message.text}
                  </ThemedText>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.center}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('noChatYet')}
                  </ThemedText>
                </View>
              }
            />
          )}

          {sendError && (
            <ThemedText style={styles.sendError} type="small">
              {sendError}
            </ThemedText>
          )}

          {blocked ? (
            <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.two }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('lostChatBlocked')}
              </ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.composer,
                {
                  borderTopColor: theme.backgroundSelected,
                  paddingBottom: insets.bottom + Spacing.two,
                },
              ]}>
              <TextInput
                maxLength={MAX_MESSAGE_LENGTH}
                multiline
                onChangeText={setDraft}
                placeholder={t('writeMessage')}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                  },
                ]}
                value={draft}
              />
              <Pressable
                accessibilityLabel={t('send')}
                disabled={!canSend}
                onPress={handleSend}
                style={[styles.sendButton, { opacity: canSend ? 1 : 0.45 }]}>
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons color="#FFFFFF" name="arrow-up" size={20} />
                )}
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  headerButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    minWidth: 28,
  },
  headerClose: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 30,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  body: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  messageList: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bubble: {
    borderRadius: 14,
    maxWidth: '82%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  sendError: {
    color: '#C84646',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
