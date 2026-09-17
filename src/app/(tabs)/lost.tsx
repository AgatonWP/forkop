import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LostItemChatModal } from '@/components/lost-item-chat-modal';
import { LostItemForm } from '@/components/lost-item-form';
import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Toast } from '@/components/toast';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  LOST_ITEM_CATEGORY_EMOJI,
  LOST_ITEM_CATEGORY_KEY,
  LostItem,
  LostItemKind,
  deleteLostItem,
  fetchOpenLostItems,
  resolveLostItem,
} from '@/lib/lost-items';
import { getNation } from '@/lib/nations';
import { formatListingEventDate, formatRelativeTime } from '@/lib/tickets';

export default function LostScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const { initializing, user } = useAuth();

  const [kind, setKind] = useState<LostItemKind>('lost');
  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [chatItem, setChatItem] = useState<LostItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      if (!user) {
        if (isActive()) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      try {
        const open = await fetchOpenLostItems();
        if (!isActive()) return;
        setItems(open);
        setError(null);
      } catch {
        if (!isActive()) return;
        setError(t('lostFetchError'));
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [t, user],
  );

  useEffect(() => {
    if (initializing) return;

    let active = true;
    setLoading(true);
    load(() => active);

    return () => {
      active = false;
    };
  }, [initializing, load]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!initializing && user) load(() => active);

      return () => {
        active = false;
      };
    }, [initializing, load, user]),
  );

  const visibleItems = useMemo(() => items.filter((item) => item.kind === kind), [items, kind]);

  function refresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  async function handleResolve(item: LostItem) {
    if (!user || pendingId) return;

    setPendingId(item.id);
    try {
      await resolveLostItem(item.id, user.id);
      setItems((current) => current.filter((existing) => existing.id !== item.id));
      setToast(t('lostResolvedToast'));
    } catch {
      setToast(t('lostResolveError'));
    } finally {
      setPendingId(null);
    }
  }

  function handleDelete(item: LostItem) {
    if (!user || pendingId) return;

    Alert.alert(t('lostOwnPost'), t('lostDeleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setPendingId(item.id);
          try {
            await deleteLostItem(item.id, user.id);
            setItems((current) => current.filter((existing) => existing.id !== item.id));
            setToast(t('lostDeletedToast'));
          } catch {
            setToast(t('lostDeleteError'));
          } finally {
            setPendingId(null);
          }
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.screen}>
      <Toast message={toast} onHidden={() => setToast(null)} topOffset={insets.top + Spacing.six} />

      <SafeAreaView
        edges={['top']}
        style={[
          styles.header,
          { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader },
        ]}>
        <View style={styles.headerInner}>
          <ThemedText style={styles.headerTitle}>{t('lostTitle')}</ThemedText>
          {user && (
            <Pressable
              accessibilityLabel={t('lostNewTitle')}
              onPress={() => setFormOpen(true)}
              style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.7 : 1 }]}>
              <ThemedText style={styles.addButtonText}>+</ThemedText>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {!initializing && !user ? (
        <View style={styles.centerNotice}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('lostSignedOut')}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={theme.textSecondary}
              colors={['#1D2430']}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
          ]}
          ListHeaderComponent={
            <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
              {(['lost', 'found'] as const).map((option) => {
                const active = kind === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() => setKind(option)}
                    style={[styles.segmentItem, active && { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText
                      type="small"
                      themeColor={active ? 'text' : 'textSecondary'}
                      style={styles.segmentLabel}>
                      {t(option === 'lost' ? 'lostSegmentLost' : 'lostSegmentFound')}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          }
          renderItem={({ item }) => (
            <LostItemCard
              item={item}
              isOwn={item.userId === user?.id}
              pending={pendingId === item.id}
              language={language}
              onContact={() => setChatItem(item)}
              onResolve={() => handleResolve(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <View style={styles.centerNotice}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
              </View>
            ) : (
              <View style={styles.centerNotice}>
                <ThemedText style={styles.emptyTitle}>
                  {error ?? t(kind === 'lost' ? 'lostEmptyLostTitle' : 'lostEmptyFoundTitle')}
                </ThemedText>
                {!error && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                    {t(kind === 'lost' ? 'lostEmptyLostCopy' : 'lostEmptyFoundCopy')}
                  </ThemedText>
                )}
              </View>
            )
          }
        />
      )}

      <LostItemForm
        visible={formOpen}
        initialKind={kind}
        onClose={() => setFormOpen(false)}
        onCreated={(created) => {
          setFormOpen(false);
          setKind(created.kind);
          setItems((current) => [created, ...current]);
          setToast(t('lostCreatedToast'));
        }}
      />

      <LostItemChatModal item={chatItem} onClose={() => setChatItem(null)} />
    </ThemedView>
  );
}

function LostItemCard({
  item,
  isOwn,
  pending,
  language,
  onContact,
  onResolve,
  onDelete,
}: {
  item: LostItem;
  isOwn: boolean;
  pending: boolean;
  language: 'sv' | 'en';
  onContact: () => void;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
      ]}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.cardEmoji}>{LOST_ITEM_CATEGORY_EMOJI[item.category]}</ThemedText>
        <View style={styles.cardCopy}>
          <ThemedText style={styles.cardTitle}>{t(LOST_ITEM_CATEGORY_KEY[item.category])}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${getNation(item.nationId).name} · ${formatListingEventDate(item.happenedOn, language)}`}
          </ThemedText>
        </View>
        <NationEmblem nationId={item.nationId} />
      </View>

      {item.description && (
        <ThemedText type="small" style={styles.cardDescription}>
          {item.description}
        </ThemedText>
      )}

      <View style={styles.cardBottom}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.cardReporter}>
          {`${item.reporterName ?? ''} · ${formatRelativeTime(item.createdAt)}`.replace(/^ · /, '')}
        </ThemedText>

        {isOwn ? (
          <View style={styles.cardActions}>
            <Pressable disabled={pending} onPress={onDelete} style={styles.ghostButton}>
              <Ionicons color={theme.textSecondary} name="trash-outline" size={18} />
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={onResolve}
              style={[styles.actionButton, { backgroundColor: theme.backgroundSelected }]}>
              {pending ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <ThemedText type="small" style={styles.actionButtonOwnText}>
                  {t('lostMarkResolved')}
                </ThemedText>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onContact} style={[styles.actionButton, styles.actionButtonPrimary]}>
            <ThemedText type="small" style={styles.actionButtonText}>
              {t(item.kind === 'found' ? 'lostActionItsMine' : 'lostActionHaveIt')}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
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
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  listContent: {
    alignSelf: 'center',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    width: '100%',
  },
  segment: {
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: Spacing.one,
    padding: 3,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontWeight: '700',
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cardEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  cardDescription: {
    lineHeight: 19,
  },
  cardBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  cardReporter: {
    flex: 1,
  },
  cardActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  ghostButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: Spacing.three,
  },
  actionButtonPrimary: {
    backgroundColor: '#1D2430',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionButtonOwnText: {
    fontWeight: '700',
  },
  centerNotice: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.six,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
  },
});
