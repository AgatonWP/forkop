import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { TranslationKey, useI18n } from '@/lib/i18n';
import { Conversation, Message, fetchConversationsForListing, fetchLatestMessages } from '@/lib/messages';
import { submitRating } from '@/lib/ratings';
import { Listing } from '@/lib/tickets';

const RATING_OPTIONS: { score: number; rotation: number; labelKey: TranslationKey }[] = [
  { score: 5, rotation: 0, labelKey: 'ratingScore5' },
  { score: 4, rotation: -45, labelKey: 'ratingScore4' },
  { score: 3, rotation: -90, labelKey: 'ratingScore3' },
  { score: 2, rotation: -135, labelKey: 'ratingScore2' },
  { score: 1, rotation: -180, labelKey: 'ratingScore1' },
];

type Props = {
  listing: Listing | null;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function RatingModal({ listing, onClose, onSubmitted }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [previews, setPreviews] = useState<Map<string, Message>>(new Map());
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listing || !user) return;

    let active = true;
    setLoading(true);
    setConversations([]);
    setPreviews(new Map());
    setSelectedBuyerId(null);
    setScore(null);
    setError(null);

    fetchConversationsForListing(listing.id)
      .then(async (convos) => {
        if (!active) return;
        setConversations(convos);
        if (convos.length === 1) {
          setSelectedBuyerId(convos[0].buyerId);
        }

        const latest = await fetchLatestMessages(
          convos.map((c) => c.id),
          user.id,
        );
        if (!active) return;
        setPreviews(latest);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('ratingSubmitError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listing, user, t]);

  async function handleSubmit() {
    if (!listing || !user || !selectedBuyerId || score === null || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitRating(listing.id, user.id, selectedBuyerId, score);
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ratingSubmitError'));
    } finally {
      setSubmitting(false);
    }
  }

  const showPicker = !loading && conversations.length > 1 && !selectedBuyerId;
  const showRating = !loading && !!selectedBuyerId;
  const showEmpty = !loading && conversations.length === 0;

  return (
    <Modal visible={!!listing} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.title}>{t('rateBuyerTitle')}</ThemedText>

          {loading && <ActivityIndicator size="small" color={theme.textSecondary} />}

          {showEmpty && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t('rateBuyerNoChats')}
              </ThemedText>
              <Pressable onPress={onClose} style={[styles.actionButton, styles.closeButton]}>
                <ThemedText style={styles.actionButtonText}>{t('done')}</ThemedText>
              </Pressable>
            </>
          )}

          {showPicker && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t('rateBuyerPickChat')}
              </ThemedText>
              <View style={styles.chatList}>
                {conversations.map((conversation) => {
                  const preview = previews.get(conversation.id);
                  return (
                    <Pressable
                      key={conversation.id}
                      onPress={() => setSelectedBuyerId(conversation.buyerId)}
                      style={[styles.chatRow, { borderColor: theme.backgroundSelected }]}>
                      <ThemedText numberOfLines={1} style={styles.chatRowText}>
                        {conversation.buyerName ?? t('buyer')}
                      </ThemedText>
                      <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                        {preview ? preview.text : t('noChatYet')}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={onClose}>
                <ThemedText style={styles.linkText}>{t('skipRatingButton')}</ThemedText>
              </Pressable>
            </>
          )}

          {showRating && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t('rateBuyerPrompt')}
              </ThemedText>

              <View style={styles.thumbRow}>
                {RATING_OPTIONS.map((option) => (
                  <Pressable
                    key={option.score}
                    accessibilityLabel={t(option.labelKey)}
                    onPress={() => setScore(option.score)}
                    style={[
                      styles.thumbButton,
                      {
                        backgroundColor: score === option.score ? '#FFC8A5' : theme.background,
                        borderColor: score === option.score ? '#E39E7273' : theme.backgroundSelected,
                      },
                    ]}>
                    <ThemedText style={[styles.thumbEmoji, { transform: [{ rotate: `${option.rotation}deg` }] }]}>
                      👍
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

              <View style={styles.actionsRow}>
                <Pressable disabled={submitting} onPress={onClose}>
                  <ThemedText style={styles.linkText}>{t('skipRatingButton')}</ThemedText>
                </Pressable>
                <Pressable
                  disabled={score === null || submitting}
                  onPress={handleSubmit}
                  style={[styles.actionButton, { opacity: score === null || submitting ? 0.5 : 1 }]}>
                  <ThemedText style={styles.actionButtonText}>
                    {submitting ? t('wait') : t('submitRatingButton')}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: '#1D243080',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    maxWidth: 360,
    padding: Spacing.four,
    width: '100%',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  chatList: {
    gap: Spacing.two,
  },
  chatRow: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    padding: Spacing.two,
  },
  chatRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    justifyContent: 'space-between',
  },
  thumbButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  thumbEmoji: {
    fontSize: 26,
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: '#687283',
    fontSize: 13,
    fontWeight: '800',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
});
