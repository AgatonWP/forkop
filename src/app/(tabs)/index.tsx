import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';

import { ChatModal } from '@/components/chat-modal';
import { Logo } from '@/components/logo';
import { getNationImage } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getNation, nationMatchesQuery } from '@/lib/nations';
import { ReportModal } from '@/components/report-modal';
import {
  Listing,
  fetchActiveListings,
  formatListingEventDate,
  formatRelativeTime,
  formatTicketQuantity,
} from '@/lib/tickets';

const TICKET_TYPE_FILTERS = [
  { id: 'Förköp', label: 'Förköp' },
  { id: 'Eftersläpp', label: 'Eftersläpp' },
];

const DEAL_FILTERS = [
  { id: 'sell', translationKey: 'sellListing' },
  { id: 'trade', translationKey: 'tradeListing' },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string | null>(null);
  const [dealFilter, setDealFilter] = useState<'sell' | 'trade' | null>(null);
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
      setListingsError(error instanceof Error ? error.message : t('listingFetchErrorSentence'));
    } finally {
      if (!isActive()) return;
      setListingsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    loadListings(() => isMounted, true);

    return () => {
      isMounted = false;
    };
  }, [loadListings]);

  // Tab screens stay mounted when you switch away, so without this the
  // feed would go stale after posting/selling elsewhere until a full
  // app reload.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadListings(() => isActive, false);

      return () => {
        isActive = false;
      };
    }, [loadListings]),
  );

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
      .filter((listing) => {
        if (!ticketTypeFilter) return true;
        if (ticketTypeFilter === 'Annan') {
          return listing.ticketType === 'Annan' || listing.ticketType.startsWith('Annan:');
        }
        return listing.ticketType === ticketTypeFilter;
      })
      .filter((listing) => {
        if (!dealFilter) return true;
        if (dealFilter === 'sell') return listing.dealType === 'sell' || listing.dealType === 'both';
        return listing.dealType === 'trade' || listing.dealType === 'both';
      })
      .filter((listing) => {
        if (!query) return true;
        const nation = getNation(listing.nationId);
        return (
          listing.eventName.toLowerCase().includes(query) ||
          nationMatchesQuery(nation, query)
        );
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [ticketTypeFilter, dealFilter, listings, search]);
  const filtersActive = !!ticketTypeFilter || !!dealFilter;

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
            <View style={styles.headerSide} />
            <View style={styles.brandBlock}>
              <Logo />
            </View>
            <View style={[styles.headerSide, styles.headerSideRight]}>
              <Pressable
                accessibilityLabel={t('sell')}
                style={({ pressed }) => [
                  styles.createButton,
                  pressed && styles.createButtonPressed,
                ]}
                onPress={() => router.push('/sell')}>
                <ThemedText style={styles.createButtonText}>+</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
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
                placeholder='"förköp casa", "gbg"...'
                placeholderTextColor="rgba(104,114,131,0.62)"
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
                    style={[styles.filterToggleText, { color: filtersOpen ? '#FFFFFF' : theme.text }]}>
                    {t('filter')}
                  </ThemedText>
                  {filtersActive && <View style={styles.filterDot} />}
                  <ThemedText
                    style={[styles.filterToggleChevron, { color: filtersOpen ? '#FFFFFF' : theme.text }]}>
                    {filtersOpen ? '︿' : '﹀'}
                  </ThemedText>
                </Pressable>

                <ThemedText type="small" themeColor="textSecondary">
                  {listingsLoading ? t('loadingListings') : `${filteredListings.length} ${t('listings')}`}
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
                      {t('ticketType')}
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {TICKET_TYPE_FILTERS.map((item) => (
                        <FilterChip
                          key={item.id}
                          label={item.label}
                          active={ticketTypeFilter === item.id}
                          onPress={() => setTicketTypeFilter((current) => (current === item.id ? null : item.id))}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
                      {t('listingType')}
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {DEAL_FILTERS.map((item) => (
                        <FilterChip
                          key={item.id}
                          label={t(item.translationKey)}
                          active={dealFilter === item.id}
                          onPress={() => setDealFilter((current) => (current === item.id ? null : item.id))}
                        />
                      ))}
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
                    {listingsError ? t('listingFetchError') : t('noTicketsFound')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                    {listingsError ?? t('broadenSearch')}
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
      <ThemedText
        style={[styles.chipText, { color: theme.textSecondary }, active && styles.chipTextActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const theme = useTheme();
  const { language, t } = useI18n();
  const nation = getNation(listing.nationId);
  const nationImage = getNationImage(listing.nationId);
  const useLogoWatermark = listing.nationId === 'mejeriet';
  const usePhotoWatermark = listing.nationId === 'karneval';
  const listingMeta = [
    nation.name,
    listing.eventDate ? formatListingEventDate(listing.eventDate, language) : null,
    formatRelativeTime(listing.createdAt),
  ].filter(Boolean).join(' · ');

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
      <View style={styles.cardInner}>
        {nationImage ? (
          <Image
            source={nationImage}
            style={
              useLogoWatermark
                ? styles.cardWatermarkImageLogo
                : usePhotoWatermark
                  ? styles.cardWatermarkImagePhoto
                  : styles.cardWatermarkImage
            }
            resizeMode={usePhotoWatermark ? 'cover' : 'contain'}
          />
        ) : (
          <View style={styles.cardWatermarkFallback}>
            <ThemedText style={[styles.cardWatermarkFallbackText, { color: nation.color }]}>
              {nation.shortName}
            </ThemedText>
          </View>
        )}

        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleBlock}>
            <View style={styles.titleRow}>
              <ThemedText numberOfLines={1} style={styles.cardTitle}>
                {listing.ticketType}
              </ThemedText>
              <View style={styles.quantityPill}>
                <ThemedText style={styles.quantityText}>
                  {formatTicketQuantity(listing.quantity)} {t('pcs')}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {listingMeta}
            </ThemedText>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {(listing.dealType === 'sell' || listing.dealType === 'both') && (
            <View style={[styles.badge, styles.sellBadge]}>
              <ThemedText style={styles.sellBadgeText}>
                {listing.price ? `${listing.price} ${t('perTicket')}` : t('forSale')}
              </ThemedText>
            </View>
          )}
          {(listing.dealType === 'trade' || listing.dealType === 'both') && (
            <View style={[styles.badge, styles.tradeBadge]}>
              <ThemedText style={styles.tradeBadgeText} numberOfLines={1}>
                {t('trade')}: {listing.tradeDescription ?? t('suggestion')}
              </ThemedText>
            </View>
          )}
          {listing.isHot && (
            <View style={[styles.badge, styles.hotBadge]}>
              <ThemedText style={styles.hotBadgeText}>{t('popular')}</ThemedText>
            </View>
          )}
        </View>
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
  const { user } = useAuth();
  const { language, t } = useI18n();
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const nationName = listing ? getNation(listing.nationId).name : '';
  const titleText = listing ? listing.ticketType : '';
  const isOwnListing = !!user && !!listing && listing.userId === user.id;

  useEffect(() => {
    if (!listing) return;
    sheetTranslateY.setValue(36);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
    <Modal animationType="fade" transparent visible={!!listing} onRequestClose={onClose}>
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
                  {listing.sellerName && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('postedBy')} {listing.sellerName}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.modalStats}>
                  {listing.eventDate && (
                    <Stat label={t('ticketDate')} value={formatListingEventDate(listing.eventDate, language)} />
                  )}
                  <Stat label={t('quantity')} value={`${formatTicketQuantity(listing.quantity)} ${t('pcs')}`} />
                  {(listing.dealType === 'sell' || listing.dealType === 'both') && listing.price && (
                    <Stat label={t('price')} value={`${listing.price} ${t('perTicket')}`} />
                  )}
                  <Stat label={t('posted')} value={formatRelativeTime(listing.createdAt)} />
                </View>

                {listing.description.trim().length > 0 && (
                  <>
                    <ThemedText style={styles.sectionLabel}>{t('description')}</ThemedText>
                    <ThemedText style={styles.description}>{listing.description}</ThemedText>
                  </>
                )}

                {listing.tradeDescription && (
                  <>
                    <ThemedText style={styles.sectionLabel}>{t('tradeWant')}</ThemedText>
                    <ThemedText style={styles.description}>{listing.tradeDescription}</ThemedText>
                  </>
                )}

                {isOwnListing ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.ownListingNote}>
                    {t('soldByOwnerNote')}
                  </ThemedText>
                ) : (
                  <>
                    <Pressable style={styles.primaryAction} onPress={() => onChat(listing)}>
                      <ThemedText style={styles.primaryActionText}>💬 {t('contactSeller')}</ThemedText>
                    </Pressable>

                    <Pressable style={styles.reportLink} onPress={() => onReport(listing)}>
                      <ThemedText type="small" style={styles.reportLinkText}>
                        🚩 {t('reportListing')}
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </ThemedView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundSelected }]}>
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
  headerSide: {
    alignItems: 'flex-start',
    flex: 1,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  brandBlock: {
    alignItems: 'center',
    flex: 1,
    height: 36,
    justifyContent: 'center',
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
    fontSize: 13,
    fontWeight: '700',
  },
  filterToggleChevron: {
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
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1D2430',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#E39E72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  cardInner: {
    borderRadius: 8,
    gap: Spacing.two,
    overflow: 'hidden',
    padding: Spacing.three,
  },
  cardWatermarkImage: {
    bottom: -24,
    height: 150,
    opacity: 0.14,
    position: 'absolute',
    right: -24,
    width: 150,
  },
  cardWatermarkImageLogo: {
    bottom: -14,
    height: 108,
    opacity: 0.16,
    position: 'absolute',
    right: -8,
    width: 216,
  },
  cardWatermarkImagePhoto: {
    bottom: 0,
    left: 0,
    opacity: 0.08,
    position: 'absolute',
    right: 0,
    top: -72,
  },
  cardWatermarkFallback: {
    alignItems: 'center',
    bottom: -46,
    justifyContent: 'center',
    opacity: 0.16,
    position: 'absolute',
    right: -28,
  },
  cardWatermarkFallbackText: {
    fontSize: 110,
    fontWeight: '900',
    letterSpacing: -4,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
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
    backgroundColor: '#FFC8A5CC',
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
  ownListingNote: {
    textAlign: 'center',
  },
});
