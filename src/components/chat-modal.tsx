import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Message, getMessages, sendMessage } from '@/lib/messages';
import { Listing, NATIONS } from '@/lib/tickets';

type Props = {
  listing: Listing | null;
  onClose: () => void;
};

export function ChatModal({ listing, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!listing) return;
    setMessages([...getMessages(listing.id)]);
  }, [listing?.id]);

  const refresh = useCallback(() => {
    if (!listing) return;
    setMessages([...getMessages(listing.id)]);
  }, [listing?.id]);

  const handleSend = useCallback(() => {
    if (!listing || !draft.trim()) return;
    sendMessage(listing.id, draft.trim());
    setDraft('');
    setMessages([...getMessages(listing.id)]);
    // refresh again after the simulated seller reply
    setTimeout(refresh, 1500);
  }, [listing, draft, refresh]);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  if (!listing) return null;

  const nationName = NATIONS[listing.nationId] ?? listing.nationId;
  const sellerName = listing.sellerName ?? nationName;

  return (
    <Modal
      animationType="slide"
      visible={!!listing}
      onRequestClose={onClose}
      statusBarTranslucent>
      <ThemedView style={styles.screen}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}>
            <ThemedText style={styles.backIcon}>‹</ThemedText>
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText numberOfLines={1} style={styles.headerTitle}>
              {listing.eventName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {sellerName} · {listing.quantity} st
            </ThemedText>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.onlineDot} />
          </View>
        </SafeAreaView>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={[
              styles.messageList,
              { paddingBottom: insets.bottom + 80 },
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
          />

          {/* Input bar */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: theme.backgroundElement,
                borderTopColor: theme.backgroundSelected,
                paddingBottom: insets.bottom + Spacing.two,
              },
            ]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Skriv ett meddelande..."
              placeholderTextColor={theme.textSecondary}
              multiline
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
              blurOnSubmit={false}
            />
            <Pressable
              onPress={handleSend}
              style={[
                styles.sendButton,
                { opacity: draft.trim() ? 1 : 0.3 },
              ]}>
              <ThemedText style={styles.sendIcon}>↑</ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
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
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    color: '#1D2430',
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 34,
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    color: '#1D2430',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
  onlineDot: {
    backgroundColor: '#34C759',
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  messageList: {
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
    color: '#1D2430',
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
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
});
