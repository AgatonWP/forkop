import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  Conversation,
  Message,
  fetchConversation,
  fetchMessages,
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
} from '@/lib/messages';
import { getNation } from '@/lib/nations';
import { Listing, formatTicketQuantity } from '@/lib/tickets';
import { useUnreadMessages } from '@/lib/unread-messages';
import { ReportModal } from '@/components/report-modal';

type Props = {
  listing: Listing | null;
  /** When opened from an inbox (e.g. as the seller), pass the known conversation id to skip creation. */
  conversationId?: string;
  onClose: () => void;
};

export function ChatModal({ listing, conversationId, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { markConversationRead } = useUnreadMessages();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const screenTranslateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    screenTranslateX.setValue(0);
  }, [listing?.id, screenTranslateX]);

  useEffect(() => {
    if (!listing || !user) return;

    let active = true;
    setLoading(true);
    setLoadError(null);
    setConversation(null);
    setMessages([]);

    const load = conversationId ? fetchConversation(conversationId) : getOrCreateConversation(listing.id, user.id);

    load
      .then(async (conv) => {
        if (!active) return;
        setConversation(conv);
        const msgs = await fetchMessages(conv.id, user.id);
        if (!active) return;
        setMessages(msgs);
        markConversationRead(conv.id);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Kunde inte ladda chatten.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listing?.id, conversationId, user?.id]);

  useEffect(() => {
    if (!conversation || !user) return;

    return subscribeToMessages(conversation.id, user.id, (message) => {
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      markConversationRead(conversation.id);
    });
  }, [conversation?.id, user?.id, markConversationRead]);

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
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Kunde inte skicka meddelandet.');
    } finally {
      setSending(false);
    }
  }, [conversation, user, draft, sending]);

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

  if (!listing) return null;

  const nationName = getNation(listing.nationId).name;
  const isSeller = !!user && listing.userId === user.id;
  const subtitle = isSeller ? 'Köpare' : nationName;

  return (
    <Modal
      animationType="slide"
      visible={!!listing}
      onRequestClose={onClose}
      statusBarTranslucent>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            transform: [{ translateX: screenTranslateX }],
          },
        ]}>
        {/* Header */}
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
          <View style={styles.headerCenter}>
            <ThemedText numberOfLines={1} style={styles.headerTitle}>
              {listing.eventName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {subtitle} · {formatTicketQuantity(listing.quantity)} st
            </ThemedText>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              accessibilityLabel="Rapportera"
              hitSlop={8}
              onPress={() => setReportOpen(true)}
              style={styles.moreButton}>
              <ThemedText style={styles.moreIcon}>⋯</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Messages */}
        <View style={styles.flex}>
          {!user ? (
            <View style={styles.centerNotice}>
              <ThemedText type="small" themeColor="textSecondary">
                Logga in för att chatta.
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
                    Inga meddelanden än. Säg hej!
                  </ThemedText>
                </View>
              }
            />
          )}

          {/* Input bar */}
          {user && !loading && !loadError && (
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
                  onChangeText={setDraft}
                  placeholder="Skriv ett meddelande..."
                  placeholderTextColor={theme.textSecondary}
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
                  onPress={handleSend}
                  disabled={sending}
                  style={[
                    styles.sendButton,
                    { opacity: draft.trim() && !sending ? 1 : 0.3 },
                  ]}>
                  <ThemedText style={styles.sendIcon}>↑</ThemedText>
                </Pressable>
              </View>
              {sendError && (
                <ThemedText style={styles.sendErrorText}>{sendError}</ThemedText>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        listing={listing}
        mode="chat"
      />
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
        <ThemedText
          style={[styles.bubbleText, message.fromMe && styles.bubbleTextMe]}>
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
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
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
