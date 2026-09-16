import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Toast } from '@/components/toast';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getNation } from '@/lib/nations';
import { getPushEnabled } from '@/lib/push-notifications';
import { MAX_TICKET_WATCHES, TicketWatch, useTicketWatches } from '@/lib/ticket-watches';
import { daysFromToday, formatListingEventDate } from '@/lib/tickets';

export default function WatchesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useAuth();
  const { language, t } = useI18n();
  const { watches, loading, refresh, removeWatch } = useTicketWatches();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    // Only to warn about silent watches; a failed check shouldn't nag.
    getPushEnabled(user.id)
      .then(setPushEnabled)
      .catch(() => setPushEnabled(true));
  }, [user]);

  async function handleRemove(watch: TicketWatch) {
    if (removingId) return;

    setRemovingId(watch.id);
    try {
      await removeWatch(watch.id);
      setToast(t('watchRemovedToast'));
    } catch {
      setToast(t('watchDeleteError'));
    } finally {
      setRemovingId(null);
    }
  }

  function describeSubject(watch: TicketWatch) {
    const organizer = watch.nationId ? getNation(watch.nationId).name : null;

    if (organizer && watch.ticketType) return `${organizer} – ${watch.ticketType}`;
    return organizer ?? watch.ticketType ?? '';
  }

  function describeDetails(watch: TicketWatch) {
    const parts: string[] = [];

    if (watch.dealType) {
      parts.push(t(watch.dealType === 'sell' ? 'sellListing' : 'tradeListing'));
    }

    if (watch.eventDates.length > 0) {
      parts.push(
        watch.eventDates
          .map((date) => {
            const diff = daysFromToday(date);
            if (diff === 0) return t('today');
            if (diff === 1) return t('tomorrow');
            return formatListingEventDate(date, language);
          })
          .join(', '),
      );
    }

    return parts.length > 0 ? parts.join(' · ') : t('watchAllListings');
  }

  return (
    <ThemedView style={styles.screen}>
      <Toast
        message={toast}
        onHidden={() => setToast(null)}
        topOffset={safeAreaInsets.top + 56 + Spacing.two}
      />
      <SafeAreaView
        edges={['top']}
        style={[
          styles.header,
          { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader },
        ]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('watchesTitle')}</ThemedText>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}>
        <View style={styles.container}>
          {!user ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('watchesSignedOut')}
              </ThemedText>
            </View>
          ) : (
            <>
              {!pushEnabled && watches.length > 0 && (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.backgroundElement, borderColor: '#E39E72' },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('watchesPushOff')}
                  </ThemedText>
                </View>
              )}

              {loading && watches.length === 0 ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : watches.length === 0 ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText style={styles.emptyTitle}>{t('watchesEmptyTitle')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('watchesEmptyCopy')}
                  </ThemedText>
                </View>
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${watches.length}/${MAX_TICKET_WATCHES} ${t('watchesCount')}`}
                  </ThemedText>

                  {watches.map((watch) => (
                    <View
                      key={watch.id}
                      style={[
                        styles.card,
                        styles.watchCard,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.backgroundSelected,
                        },
                      ]}>
                      <View style={styles.watchCopy}>
                        <ThemedText style={styles.watchSubject}>{describeSubject(watch)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {describeDetails(watch)}
                        </ThemedText>
                      </View>
                      <Pressable
                        accessibilityLabel={t('delete')}
                        disabled={removingId === watch.id}
                        onPress={() => handleRemove(watch)}
                        style={({ pressed }) => [styles.removeButton, { opacity: pressed ? 0.6 : 1 }]}>
                        {removingId === watch.id ? (
                          <ActivityIndicator size="small" color={theme.textSecondary} />
                        ) : (
                          <Ionicons color={theme.textSecondary} name="trash-outline" size={20} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
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
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  backButtonText: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 30,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  container: {
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.one,
    padding: Spacing.three,
  },
  watchCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  watchCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  watchSubject: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  removeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
});
