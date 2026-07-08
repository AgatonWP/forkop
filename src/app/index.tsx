import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ChatModal } from '@/components/chat-modal';
import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getNation } from '@/lib/nations';
import { ReportModal } from '@/components/report-modal';
import {
  Listing,
  fetchActiveListings,
  formatRelativeTime,
  formatTicketQuantity,
} from '@/lib/tickets';

const TICKET_TYPE_FILTERS = [
  { id: 'all', label: 'Alla' },
  { id: 'Förköp', label: 'Förköp' },
  { id: 'Eftersläpp', label: 'Eftersläpp' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('all');
  const [dealFilter, setDealFilter] = useState<'all' | 'sell' | 'trade'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [chatListing, setChatListing] = useState<Listing | null>(null);
  const [reportListing, setReportListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadListings = useCallback(async (isActive: () => boolean = () => true, showInitialLoader = false) => {
    if (showInitialLoader) {
      setListingsLoading(true);
    }

    try {
      const items = await fetchActiveListings();
      if (!isActive()) return;
      setListings(items);
      setListingsError(null);
    } catch (error) {
      if (!isActive()) return;
      setListingsError(error instanceof Error ? error.message : 'Kunde inte hämta annonser.');
    } finally {
      if (!isActive()) return;
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadListings(() => isMounted, true);

    return () => {
      isMounted = false;
    };
  }, [loadListings]);

  const refreshListings = useCallback(() => {
    setRefreshing(true);
    loadListings().finally(() => {
      setRefreshing(false);
    });
  }, [loadListings]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return listings
      .filter((listing) => !listing.isSold)
      .filter((listing) => ticketTypeFilter === 'all' || listing.ticketType === ticketTypeFilter)
      .filter((listing) => {
        if (dealFilter === 'all') return true;
        if (dealFilter === 'sell') return listing.dealType === 'sell' || listing.dealType === 'both';
        return listing.dealType === 'trade' || listing.dealType === 'both';
      })
      .filter((listing) => {
        if (!query) return true;
        return (
          listing.eventName.toLowerCase().includes(query) ||
          getNation(listing.nationId).name.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [ticketTypeFilter, dealFilter, listings, search]);
  const filtersActive = ticketTypeFilter !== 'all' || dealFilter !== 'all';

  return (
    <ThemedView style={[styles.screen, Platform.OS === 'web' && webGradient as any]}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.backgroundSelected,
              backgroundColor: theme.backgroundHeader,
              paddingTop: insets.top + Spacing.two,
            },
          ]}>
          <View style={styles.headerRow}>
            <View style={styles.brandBlock}>
              <ThemedText style={styles.brandTitle}>FÖRKÖP LUND</ThemedText>
            </View>
            <Pressable
              accessibilityLabel="Lägg upp annons"
              style={({ pressed }) => [
                styles.createButton,
                pressed && styles.createButtonPressed,
              ]}
              onPress={() => router.push('/sell')}>
              <ThemedText style={styles.createButtonText}>+</ThemedText>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshListings}
              tintColor={theme.textSecondary}
              colors={['#1D2430']}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
            },
          ]}
          ListHeaderComponent={
            <View style={styles.filters}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Sök event eller nation"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: '#E39E7233',
                    color: theme.text,
                  },
                ]}
              />

              <View style={styles.filterToggleRow}>
                <Pressable
                  onPress={() => setFiltersOpen((open) => !open)}
                  style={[
                    styles.filterToggle,
                    {
                      backgroundColor: filtersOpen ? '#1D2430' : theme.backgroundElement,
                      borderColor: filtersOpen ? '#1D2430' : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    style={[styles.filterToggleText, filtersOpen && styles.filterToggleTextActive]}>
                    Filtrera
                  </ThemedText>
                  {filtersActive && <View style={styles.filterDot} />}
                  <ThemedText
                    style={[styles.filterToggleChevron, filtersOpen && styles.filterToggleTextActive]}>
                    {filtersOpen ? '︿' : '﹀'}
                  </ThemedText>
                </Pressable>

                <ThemedText type="small" themeColor="textSecondary">
                  {listingsLoading ? 'Hämtar annonser...' : `${filteredListings.length} annonser`}
                </ThemedText>
              </View>

              {filtersOpen && (
                <View
                  style={[
                    styles.filterPanel,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, borderWidth: 1 },
                  ]}>
                  <View style={styles.filterGroup}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
                      Biljettyp
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {TICKET_TYPE_FILTERS.map((item) => (
                        <FilterChip
                          key={item.id}
                          label={item.label}
                          active={ticketTypeFilter === item.id}
                          onPress={() => setTicketTypeFilter(item.id)}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
                      Typ av annons
                    </ThemedText>
                    <View style={styles.segment}>
                      <SegmentButton
                        label="Alla"
                        active={dealFilter === 'all'}
                        onPress={() => setDealFilter('all')}
                      />
                      <SegmentButton
                        label="Köpa"
                        active={dealFilter === 'sell'}
                        onPress={() => setDealFilter('sell')}
                      />
                      <SegmentButton
                        label="Byta"
                        active={dealFilter === 'trade'}
                        onPress={() => setDealFilter('trade')}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => setSelectedListing(item)} />
          )}
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              {listingsLoading ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <>
                  <ThemedText style={styles.emptyTitle}>
                    {listingsError ? 'Kunde inte hämta annonser' : 'Inga biljetter hittades'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                    {listingsError ?? 'Prova en bredare sökning eller byt filter.'}
                  </ThemedText>
                </>
              )}
            </ThemedView>
          }
        />
      </SafeAreaView>

      <ListingModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onChat={(l: Listing) => {
          setSelectedListing(null);
          setChatListing(l);
        }}
        onReport={(l: Listing) => {
          setSelectedListing(null);
          setReportListing(l);
        }}
      />
      <ChatModal listing={chatListing} onClose={() => setChatListing(null)} />
      <ReportModal
        visible={!!reportListing}
        onClose={() => setReportListing(null)}
        listing={reportListing}
        mode="listing"
      />
    </ThemedView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? '#FFC8A5' : theme.backgroundElement,
          borderColor: active ? '#E39E7273' : theme.backgroundSelected,
        },
      ]}>
      <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{label}</ThemedText>
    </Pressable>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</ThemedText>
    </Pressable>
  );
}

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const theme = useTheme();
  const nationName = getNation(listing.nationId).name;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <View style={styles.cardTopRow}>
        <NationEmblem nationId={listing.nationId} />
        <View style={styles.cardTitleBlock}>
          <View style={styles.titleRow}>
            <ThemedText numberOfLines={1} style={styles.cardTitle}>
              {listing.eventName.includes(' – ') ? (
                <>
                  {listing.eventName.slice(0, listing.eventName.indexOf(' – '))}
                  <Text style={styles.cardTitleSub}>{' · ' + listing.eventName.slice(listing.eventName.indexOf(' – ') + 3)}</Text>
                </>
              ) : listing.eventName}
            </ThemedText>
            <View style={styles.quantityPill}>
              <ThemedText style={styles.quantityText}>
                {formatTicketQuantity(listing.quantity)} st
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {nationName} · {formatRelativeTime(listing.createdAt)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {(listing.dealType === 'sell' || listing.dealType === 'both') && (
          <View style={[styles.badge, styles.sellBadge]}>
            <ThemedText style={styles.sellBadgeText}>
              {listing.price ? `${listing.price} kr/st` : 'Säljes'}
            </ThemedText>
          </View>
        )}
        {(listing.dealType === 'trade' || listing.dealType === 'both') && (
          <View style={[styles.badge, styles.tradeBadge]}>
            <ThemedText style={styles.tradeBadgeText} numberOfLines={1}>
              Byte: {listing.tradeDescription ?? 'förslag'}
            </ThemedText>
          </View>
        )}
        {listing.isHot && (
          <View style={[styles.badge, styles.hotBadge]}>
            <ThemedText style={styles.hotBadgeText}>Populär</ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ListingModal({
  listing,
  onClose,
  onChat,
  onReport,
}: {
  listing: Listing | null;
  onClose: () => void;
  onChat: (listing: Listing) => void;
  onReport: (listing: Listing) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const nationName = listing ? getNation(listing.nationId).name : '';
  const titleText = listing
    ? listing.eventName.includes(' – ')
      ? listing.eventName.slice(listing.eventName.indexOf(' – ') + 3)
      : listing.eventName
    : '';

  useEffect(() => {
    sheetTranslateY.setValue(0);
  }, [listing?.id, sheetTranslateY]);

  const closeFromDrag = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      sheetTranslateY.setValue(0);
      onClose();
    });
  }, [onClose, sheetTranslateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          sheetTranslateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 1.1) {
            closeFromDrag();
            return;
          }

          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 5,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 5,
          }).start();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [closeFromDrag, sheetTranslateY],
  );

  return (
    <Modal animationType="slide" transparent visible={!!listing} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityLabel="Stäng annons"
          onPress={onClose}
          style={styles.modalBackdropPressable}
        />
        <Animated.View
          style={[
            styles.modalAnimatedSheet,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}>
          <ThemedView
            type="backgroundElement"
            style={[
              styles.modalSheet,
              {
                paddingBottom: insets.bottom + Spacing.four,
                borderColor: theme.backgroundSelected,
              },
            ]}>
            {listing && (
              <>
                <View style={styles.modalDragArea} {...panResponder.panHandlers}>
                  <View style={styles.modalHandle} />
                </View>
                <View style={styles.modalHeader}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {nationName}
                  </ThemedText>
                  <ThemedText style={styles.modalTitle}>{titleText}</ThemedText>
                </View>

                <View style={styles.modalStats}>
                  <Stat label="Antal" value={`${formatTicketQuantity(listing.quantity)} st`} />
                  <Stat label="Typ" value={listing.ticketType} />
                  {(listing.dealType === 'sell' || listing.dealType === 'both') && listing.price && (
                    <Stat label="Pris" value={`${listing.price} kr/st`} />
                  )}
                  <Stat label="Upplagd" value={formatRelativeTime(listing.createdAt)} />
                </View>

                <ThemedText style={styles.sectionLabel}>Beskrivning</ThemedText>
                <ThemedText style={styles.description}>{listing.description}</ThemedText>

                {listing.tradeDescription && (
                  <>
                    <ThemedText style={styles.sectionLabel}>Vill byta mot</ThemedText>
                    <ThemedText style={styles.description}>{listing.tradeDescription}</ThemedText>
                  </>
                )}

                <Pressable style={styles.primaryAction} onPress={() => onChat(listing)}>
                  <ThemedText style={styles.primaryActionText}>💬 Kontakta säljaren</ThemedText>
                </Pressable>

                <Pressable style={styles.reportLink} onPress={() => onReport(listing)}>
                  <ThemedText type="small" style={styles.reportLinkText}>
                    🚩 Rapportera annons
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

const webGradient = Platform.OS === 'web' ? {
  backgroundImage: 'linear-gradient(180deg, #F8F9FB 0%, #F6F7F9 42%, #F4F6F8 100%)',
} : {};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#1D2430',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: 12,
    paddingTop: 4,
  },
  brandBlock: {
    height: 36,
    justifyContent: 'center',
    minWidth: 150,
  },
  brandTitle: {
    color: '#1D2430',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
    lineHeight: 22,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    shadowColor: '#1D2430',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: 36,
  },
  createButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  listContent: {
    alignSelf: 'center',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    width: '100%',
  },
  filters: {
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  filterToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterToggle: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
  },
  filterToggleText: {
    color: '#1D2430',
    fontSize: 13,
    fontWeight: '700',
  },
  filterToggleTextActive: {
    color: '#FFFFFF',
  },
  filterToggleChevron: {
    color: '#1D2430',
    fontSize: 11,
  },
  filterDot: {
    backgroundColor: '#E39E72',
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  filterPanel: {
    borderRadius: 10,
    gap: Spacing.three,
    padding: Spacing.two,
  },
  filterGroup: {
    gap: Spacing.one,
  },
  filterGroupLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
  },
  chipText: {
    color: '#687283',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1D2430',
  },
  segment: {
    backgroundColor: '#EEF0F4',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#776B63',
    fontSize: 14,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#1D2430',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
    shadowColor: '#E39E72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cardTitleSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#687283',
    textTransform: 'none',
    letterSpacing: 0,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 23,
    textTransform: 'uppercase',
  },
  quantityPill: {
    backgroundColor: '#FFC8A54D',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  quantityText: {
    color: '#1D2430',
    fontSize: 12,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingLeft: 44,
  },
  badge: {
    borderRadius: 6,
    maxWidth: '100%',
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  sellBadge: {
    backgroundColor: '#E8F6EC',
  },
  sellBadgeText: {
    color: '#216B3A',
    fontSize: 12,
    fontWeight: '800',
  },
  tradeBadge: {
    backgroundColor: '#EAF0FF',
  },
  tradeBadgeText: {
    color: '#365C9F',
    fontSize: 12,
    fontWeight: '800',
  },
  hotBadge: {
    backgroundColor: '#FFC8A54D',
  },
  hotBadgeText: {
    color: '#7A4A2F',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: 8,
    gap: Spacing.one,
    padding: Spacing.five,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCopy: {
    textAlign: 'center',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(29,36,48,0.24)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalAnimatedSheet: {
    width: '100%',
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  modalDragArea: {
    alignItems: 'center',
    marginHorizontal: -Spacing.three,
    marginTop: -Spacing.two,
    paddingBottom: Spacing.two,
    paddingTop: Spacing.two,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#D5DAE2',
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  modalHeader: {
    gap: 2,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  modalStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    backgroundColor: '#F6F7F9',
    borderRadius: 8,
    flex: 1,
    padding: Spacing.two,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionLabel: {
    color: '#9F6A49',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  reportLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  reportLinkText: {
    color: '#A15353',
    fontWeight: '700',
  },
});
