import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';

import { AddButton } from '@/components/add-button';
import { ChatModal } from '@/components/chat-modal';
import { Logo } from '@/components/logo';
import { getNationImage } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { Toast } from '@/components/toast';
import { OfficialAccountBadge, VerifiedOrganizerBadge } from '@/components/verified-organizer-badge';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { TranslationKey, useI18n } from '@/lib/i18n';
import { ORGANIZERS, getNation, getNationSearchText, listedWithoutSearch, normalizeSearchText } from '@/lib/nations';
import { getPushEnabled, registerForPushNotifications } from '@/lib/push-notifications';
import { RatingSummary, fetchRatingSummary } from '@/lib/ratings';
import {
  TicketWatchFilters,
  WATCH_LIMIT_REACHED,
  canBeWatched,
  useTicketWatches,
} from '@/lib/ticket-watches';
import { useVerifiedOrganizers } from '@/lib/verified-organizers';
import { ReportModal } from '@/components/report-modal';
import { SideSwitch } from '@/components/side-switch';
import {
  FILTERABLE_TICKET_TYPES,
  Listing,
  daysFromToday,
  fetchActiveListings,
  fetchListingsByIds,
  formatListingEventDate,
  formatRelativeTime,
  formatTicketQuantity,
  getListingOrganizerName,
  toLocalDateId,
} from '@/lib/tickets';

// Shared by the search row and the filter row, so their columns line up.
const FILTER_ROW_GAP = 6;

const TICKET_TYPE_FILTERS = FILTERABLE_TICKET_TYPES.map((type) => ({ id: type, label: type }));

const DEAL_FILTERS = [
  { id: 'sell', translationKey: 'sellListing' },
  { id: 'trade', translationKey: 'tradeListing' },
] as const;

const NATION_FILTER_OPTIONS = ORGANIZERS.map((nation) => ({
  id: nation.id,
  label: nation.name,
  searchTerms: [nation.shortName, ...nation.aliases],
  searchOnly: nation.searchOnly,
}));

function formatDayFilterLabel(dateString: string, language: 'sv' | 'en', t: (key: TranslationKey) => string) {
  const diff = daysFromToday(dateString);
  if (diff === 0) return t('today');
  if (diff === 1) return t('tomorrow');
  return formatListingEventDate(dateString, language);
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const { user } = useAuth();
  const { addWatch, removeWatch, findWatch } = useTicketWatches();
  const [watchSubmitting, setWatchSubmitting] = useState(false);
  // "Köpa" shows what is for sale, exactly the feed that existed before wanted
  // posts; "Sälja" shows people looking for tickets. Named after what the
  // user wants to do rather than after the posts, so the default reads right.
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const sideDirection = side === 'buy' ? 'offer' : 'wanted';
  const [search, setSearch] = useState('');
  const [nationFilter, setNationFilter] = useState<string | null>(null);
  const [nationPickerOpen, setNationPickerOpen] = useState(false);
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string | null>(null);
  const [ticketTypePickerOpen, setTicketTypePickerOpen] = useState(false);
  const [dealFilter, setDealFilter] = useState<'sell' | 'trade' | null>(null);
  const [dealPickerOpen, setDealPickerOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<Set<string>>(new Set());
  const [dayFilterModalOpen, setDayFilterModalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [chatListing, setChatListing] = useState<Listing | null>(null);
  const [reportListing, setReportListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const params = useLocalSearchParams<{ confirmed?: string }>();

  // Set by the signup-confirmation deep link once the session is established.
  // Guarded by a ref rather than clearing the param, because a cold start on
  // the deep link runs this before the navigator is ready to be touched.
  const confirmedToastShown = useRef(false);
  useEffect(() => {
    if (params.confirmed !== '1' || confirmedToastShown.current) return;
    confirmedToastShown.current = true;
    setToast(t('accountConfirmedToast'));
  }, [params.confirmed, t]);

  const loadListings = useCallback(async (isActive: () => boolean = () => true, showInitialLoader = false) => {
    if (showInitialLoader) {
      setListingsLoading(true);
    }

    try {
      const items = await fetchActiveListings();
      if (!isActive()) return;
      setListings(items);
      setListingsError(null);
    } catch {
      if (!isActive()) return;
      setListingsError(t('listingFetchErrorSentence'));
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

  const listingDaySet = useMemo(() => {
    const uniqueDates = new Set<string>();
    listings.forEach((listing) => {
      if (!listing.isSold && listing.eventDate && listing.direction === sideDirection) {
        uniqueDates.add(listing.eventDate);
      }
    });
    return uniqueDates;
  }, [listings, sideDirection]);

  function toggleDayFilter(day: string) {
    setDayFilter((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  // On a wanted post 'sell' means the poster pays money, so the label follows.
  const dealFilterLabel = useCallback(
    (id: 'sell' | 'trade') =>
      id === 'trade' ? t('tradeListing') : side === 'sell' ? t('wantedDealBuy') : t('sellListing'),
    [side, t],
  );
  const dealFilterOptions = useMemo(
    () => DEAL_FILTERS.map((item) => ({ id: item.id, label: dealFilterLabel(item.id) })),
    [dealFilterLabel],
  );

  const dayFilterButtonLabel = useMemo(() => {
    if (dayFilter.size === 0) return t('allDays');
    if (dayFilter.size === 1) {
      const [only] = Array.from(dayFilter);
      return formatDayFilterLabel(only, language, t);
    }
    return `${dayFilter.size} ${t('daysSelected')}`;
  }, [dayFilter, language, t]);

  const filteredListings = useMemo(() => {
    // Every word has to turn up somewhere in the listing — its name, ticket
    // type, description, what it trades for, or the organizer's aliases — so
    // "förköp casa" finds Malmö's förköp, and a ticket whose real name only
    // appears in the description ("efterkarnevalen") is still found.
    const queryWords = normalizeSearchText(search.trim()).split(/\s+/).filter(Boolean);

    return listings
      .filter((listing) => !listing.isSold && listing.direction === sideDirection)
      .filter((listing) => !nationFilter || listing.nationId === nationFilter)
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
        if (dayFilter.size === 0) return true;
        return !!listing.eventDate && dayFilter.has(listing.eventDate);
      })
      .filter((listing) => {
        if (queryWords.length === 0) return true;
        const haystack = normalizeSearchText(
          [
            listing.eventName,
            listing.ticketType,
            listing.description,
            listing.tradeDescription ?? '',
            getNationSearchText(getNation(listing.nationId)),
          ].join(' '),
        );
        return queryWords.every((word) => haystack.includes(word));
      })
      .sort((a, b) => {
        const aDiff = a.eventDate ? daysFromToday(a.eventDate) : null;
        const bDiff = b.eventDate ? daysFromToday(b.eventDate) : null;

        if (aDiff === null && bDiff === null) return b.createdAt.getTime() - a.createdAt.getTime();
        if (aDiff === null) return 1;
        if (bDiff === null) return -1;

        const proximityDiff = Math.abs(aDiff) - Math.abs(bDiff);
        return proximityDiff !== 0 ? proximityDiff : aDiff - bDiff;
      });
  }, [nationFilter, ticketTypeFilter, dealFilter, dayFilter, listings, search, sideDirection]);

  // The free-text search is left out on purpose: it matches loosely on event
  // names and nation aliases, which would make it impossible to tell what a
  // watch will actually notify about.
  const watchFilters = useMemo<TicketWatchFilters>(
    () => ({
      nationId: nationFilter,
      ticketType: ticketTypeFilter,
      dealType: dealFilter,
      eventDates: Array.from(dayFilter).sort(),
    }),
    [nationFilter, ticketTypeFilter, dealFilter, dayFilter],
  );
  const existingWatch = findWatch(watchFilters);

  const createWatch = useCallback(async () => {
    setWatchSubmitting(true);

    try {
      await addWatch(watchFilters);
      setToast(t('watchCreatedToast'));
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      setToast(reason === WATCH_LIMIT_REACHED ? t('watchLimitToast') : t('watchSaveError'));
    } finally {
      setWatchSubmitting(false);
    }
  }, [addWatch, t, watchFilters]);

  async function handleToggleWatch() {
    if (watchSubmitting || !canBeWatched(watchFilters)) return;

    if (!user) {
      setToast(t('watchSignInRequired'));
      return;
    }

    if (existingWatch) {
      setWatchSubmitting(true);
      try {
        await removeWatch(existingWatch.id);
        setToast(t('watchRemovedToast'));
      } catch {
        setToast(t('watchDeleteError'));
      } finally {
        setWatchSubmitting(false);
      }
      return;
    }

    let pushEnabled = false;
    try {
      pushEnabled = await getPushEnabled(user.id);
    } catch {
      pushEnabled = false;
    }

    // A watch belongs to the account, not to this device, so the browser can
    // still save one for the phone to be notified about.
    if (pushEnabled || Platform.OS === 'web') {
      await createWatch();
      return;
    }

    Alert.alert(t('watchNeedsPushTitle'), t('watchNeedsPushCopy'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('watchNeedsPushConfirm'),
        onPress: async () => {
          setWatchSubmitting(true);
          try {
            await registerForPushNotifications(user.id);
          } catch (error) {
            setToast(error instanceof Error ? error.message : t('pushToggleError'));
            return;
          } finally {
            setWatchSubmitting(false);
          }

          await createWatch();
        },
      },
    ]);
  }

  // A watch notification should land on the ticket it is about.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;

    async function openNotifiedListing(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data as {
        type?: string;
        listingId?: string;
      };

      if (data?.type !== 'watch' || typeof data.listingId !== 'string') return;

      // Otherwise the same tap reopens the listing on every later launch.
      await Notifications.clearLastNotificationResponseAsync();

      try {
        const [listing] = await fetchListingsByIds([data.listingId]);
        if (active && listing) setSelectedListing(listing);
      } catch {
        // Sold or removed in the meantime; the list itself is still correct.
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotifiedListing(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotifiedListing);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <ThemedView style={[styles.screen, Platform.OS === 'web' && webGradient as any]}>
      <Toast
        message={toast}
        onHidden={() => setToast(null)}
        topOffset={insets.top + Spacing.six}
      />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.backgroundSelected,
              backgroundColor: theme.backgroundHeader,
              paddingTop: insets.top + Spacing.half,
            },
          ]}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide} />
            <View style={styles.brandBlock}>
              <Logo />
            </View>
            <View style={[styles.headerSide, styles.headerSideRight]}>
              {/* Posts the kind of listing on screen: an offer under Köp, a
                  wanted post under Sälj, where the wanted posts are listed. */}
              <AddButton
                accessibilityLabel={t('sell')}
                onPress={() => router.push(side === 'sell' ? '/sell?direction=wanted' : '/sell')}
              />
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
              {/* Search and Köp | Sälj share one row, half each, so the feed
                  starts a row higher. Same gap as the filter row below, so the
                  search field ends exactly where the second filter does. Each
                  sits in a bare half of its own: a flex item's padding and
                  border count on top of its share, and on web a TextInput
                  also keeps its intrinsic width. */}
              <View style={styles.searchRow}>
                <View style={styles.searchRowHalf}>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    // Half a row is too narrow for a second example.
                    placeholder='"förköp casa"...'
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
                </View>

                <View style={styles.searchRowHalf}>
                  <SideSwitch
                    options={[
                      { id: 'buy', label: t('sideBuy') },
                      { id: 'sell', label: t('sideSell') },
                    ]}
                    value={side}
                    onChange={setSide}
                    style={styles.searchRowFill}
                  />
                </View>
              </View>

              <View style={styles.filterBarRow}>
                <FilterBarButton
                  label={t('nationLabel')}
                  value={nationFilter ? getNation(nationFilter).shortName : t('all')}
                  active={!!nationFilter}
                  onPress={() => setNationPickerOpen(true)}
                />
                <FilterBarButton
                  label={t('ticketTypeShortLabel')}
                  value={ticketTypeFilter ?? t('all')}
                  active={!!ticketTypeFilter}
                  onPress={() => setTicketTypePickerOpen(true)}
                />
                <FilterBarButton
                  label={t('dealTypeShortLabel')}
                  value={dealFilter ? dealFilterLabel(dealFilter) : t('all')}
                  active={!!dealFilter}
                  onPress={() => setDealPickerOpen(true)}
                />
                <FilterBarButton
                  label={t('dateLabel')}
                  value={dayFilterButtonLabel}
                  active={dayFilter.size > 0}
                  onPress={() => setDayFilterModalOpen(true)}
                />
              </View>

              <View style={styles.resultRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {listingsLoading
                    ? t('loadingListings')
                    : `${filteredListings.length} ${filteredListings.length === 1 ? t('listing') : t('listings')}`}
                </ThemedText>

                {side === 'buy' && canBeWatched(watchFilters) && (
                  <Pressable
                    accessibilityLabel={existingWatch ? t('watchActiveButton') : t('watchButton')}
                    disabled={watchSubmitting}
                    onPress={handleToggleWatch}
                    style={({ pressed }) => [
                      styles.watchButton,
                      {
                        backgroundColor: existingWatch ? '#4F6FB7' : theme.backgroundElement,
                        borderColor: existingWatch ? '#4F6FB7' : theme.backgroundSelected,
                        opacity: pressed || watchSubmitting ? 0.7 : 1,
                      },
                    ]}>
                    <Ionicons
                      color={existingWatch ? '#FFFFFF' : theme.textSecondary}
                      name={existingWatch ? 'notifications' : 'notifications-outline'}
                      size={13}
                    />
                    <ThemedText
                      type="smallBold"
                      style={{ color: existingWatch ? '#FFFFFF' : theme.textSecondary }}>
                      {existingWatch ? t('watchActiveButton') : t('watchButton')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
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
                    {listingsError
                      ? t('listingFetchError')
                      : side === 'buy'
                        ? t('noTicketsFound')
                        : t('wantedEmptyTitle')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                    {listingsError ?? (side === 'buy' ? t('offersEmptyCopy') : t('wantedEmptyCopy'))}
                  </ThemedText>
                  {/* Finding nothing is exactly when a wanted post is worth making,
                      so this is where "Jag söker" gets preselected. */}
                  {!listingsError && (
                    <Pressable
                      onPress={() =>
                        router.push(side === 'buy' ? '/sell?direction=wanted' : '/sell')
                      }
                      style={({ pressed }) => [styles.emptyCta, { opacity: pressed ? 0.8 : 1 }]}>
                      <ThemedText style={styles.emptyCtaText}>
                        {side === 'buy' ? t('postWantedCta') : t('postOfferCta')}
                      </ThemedText>
                    </Pressable>
                  )}
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
      <DayFilterCalendarModal
        visible={dayFilterModalOpen}
        calendarMonth={calendarMonth}
        onChangeMonth={setCalendarMonth}
        selectedDays={dayFilter}
        markedDays={listingDaySet}
        onToggleDay={toggleDayFilter}
        onClear={() => setDayFilter(new Set())}
        onClose={() => setDayFilterModalOpen(false)}
      />
      <FilterOptionModal
        visible={nationPickerOpen}
        title={t('nationLabel')}
        options={NATION_FILTER_OPTIONS}
        selectedId={nationFilter}
        onSelect={setNationFilter}
        onClose={() => setNationPickerOpen(false)}
        searchable
      />
      <FilterOptionModal
        visible={ticketTypePickerOpen}
        title={t('ticketType')}
        options={TICKET_TYPE_FILTERS}
        selectedId={ticketTypeFilter}
        onSelect={setTicketTypeFilter}
        onClose={() => setTicketTypePickerOpen(false)}
      />
      <FilterOptionModal
        visible={dealPickerOpen}
        title={t('listingType')}
        options={dealFilterOptions}
        selectedId={dealFilter}
        onSelect={(id) => setDealFilter(id as 'sell' | 'trade' | null)}
        onClose={() => setDealPickerOpen(false)}
      />
    </ThemedView>
  );
}

function FilterBarButton({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterBarButton,
        {
          backgroundColor: active ? '#FFC8A5' : theme.backgroundElement,
          borderColor: active ? '#E39E7273' : theme.backgroundSelected,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <ThemedText
        numberOfLines={1}
        style={[styles.filterBarButtonLabel, { color: active ? '#1D2430' : theme.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.filterBarButtonValue, { color: active ? '#1D2430' : theme.text }]}>
        {value}
      </ThemedText>
    </Pressable>
  );
}

type FilterOption = { id: string; label: string; searchTerms?: string[]; searchOnly?: boolean };

function FilterOptionModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  searchable,
}: {
  visible: boolean;
  title: string;
  options: FilterOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  searchable?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    if (!normalizedQuery) return options.filter((option) => listedWithoutSearch(option, selectedId));

    return options.filter((option) =>
      normalizeSearchText([option.id, option.label, ...(option.searchTerms ?? [])].join(' ')).includes(
        normalizedQuery,
      ),
    );
  }, [options, query, selectedId]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
        <Pressable accessibilityLabel="Stäng" onPress={onClose} style={styles.modalBackdropPressable} />
        <ThemedView
          type="backgroundElement"
          style={[styles.filterOptionSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.modalHandle} />
          <ThemedText style={styles.filterOptionTitle}>{title}</ThemedText>

          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('nationOrganizer')}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.filterOptionSearchInput,
                { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
              ]}
            />
          )}

          <ScrollView style={styles.filterOptionScroll} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              style={[
                styles.filterOptionRow,
                {
                  borderColor: theme.backgroundSelected,
                  backgroundColor: selectedId === null ? '#FFC8A520' : 'transparent',
                },
              ]}>
              <ThemedText style={styles.filterOptionRowText}>{t('all')}</ThemedText>
              {selectedId === null && <ThemedText style={styles.filterOptionCheck}>✓</ThemedText>}
            </Pressable>
            {filteredOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  onSelect(option.id);
                  onClose();
                }}
                style={[
                  styles.filterOptionRow,
                  {
                    borderColor: theme.backgroundSelected,
                    backgroundColor: selectedId === option.id ? '#FFC8A520' : 'transparent',
                  },
                ]}>
                <ThemedText style={styles.filterOptionRowText}>{option.label}</ThemedText>
                {selectedId === option.id && <ThemedText style={styles.filterOptionCheck}>✓</ThemedText>}
              </Pressable>
            ))}
            {filteredOptions.length === 0 && (
              <View style={[styles.filterOptionEmptyRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('emptyMatches')}
                </ThemedText>
              </View>
            )}
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DayFilterCalendarModal({
  visible,
  calendarMonth,
  onChangeMonth,
  selectedDays,
  markedDays,
  onToggleDay,
  onClear,
  onClose,
}: {
  visible: boolean;
  calendarMonth: Date;
  onChangeMonth: (month: Date) => void;
  selectedDays: Set<string>;
  markedDays: Set<string>;
  onToggleDay: (day: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const locale = language === 'sv' ? 'sv-SE' : 'en-GB';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarMonth);
  const weekdayLabels = language === 'sv' ? ['M', 'T', 'O', 'T', 'F', 'L', 'S'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: startWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  const todayId = toLocalDateId(new Date());

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityLabel="Stäng" onPress={onClose} style={styles.modalBackdropPressable} />
        <ThemedView
          type="backgroundElement"
          style={[styles.calendarSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.modalHandle} />

          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => onChangeMonth(new Date(year, month - 1, 1))}
              style={styles.calendarNavButton}>
              <ThemedText style={styles.calendarNavIcon}>‹</ThemedText>
            </Pressable>
            <ThemedText style={styles.calendarTitle}>{monthLabel}</ThemedText>
            <Pressable
              onPress={() => onChangeMonth(new Date(year, month + 1, 1))}
              style={styles.calendarNavButton}>
              <ThemedText style={styles.calendarNavIcon}>›</ThemedText>
            </Pressable>
          </View>

          <View style={styles.calendarWeekdayRow}>
            {weekdayLabels.map((label, index) => (
              <ThemedText
                key={index}
                type="small"
                themeColor="textSecondary"
                style={styles.calendarWeekdayLabel}>
                {label}
              </ThemedText>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.calendarWeekRow}>
              {week.map((day, dayIndex) => {
                if (day === null) {
                  return <View key={dayIndex} style={styles.calendarDayCell} />;
                }

                const dayId = toLocalDateId(new Date(year, month, day));
                const active = selectedDays.has(dayId);
                const hasListings = markedDays.has(dayId);
                const isToday = dayId === todayId;

                return (
                  <View key={dayIndex} style={styles.calendarDayCell}>
                    <Pressable
                      onPress={() => onToggleDay(dayId)}
                      style={[
                        styles.calendarDayButton,
                        {
                          backgroundColor: active ? '#FFC8A5' : 'transparent',
                          borderColor: active ? '#E39E7273' : isToday ? '#9F6A49' : 'transparent',
                        },
                      ]}>
                      <ThemedText
                        style={[
                          styles.calendarDayText,
                          (active || isToday) && styles.calendarDayTextActive,
                          { color: active ? '#1D2430' : isToday ? '#9F6A49' : theme.text },
                        ]}>
                        {day}
                      </ThemedText>
                      {hasListings && (
                        <View
                          style={[
                            styles.calendarDayDot,
                            { backgroundColor: active ? '#1D2430' : '#9F6A49' },
                          ]}
                        />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.calendarFooter}>
            <Pressable onPress={onClear} style={styles.calendarClearButton}>
              <ThemedText style={styles.calendarClearButtonText}>{t('clearDates')}</ThemedText>
            </Pressable>
            <Pressable onPress={onClose} style={styles.calendarDoneButton}>
              <ThemedText style={styles.calendarDoneButtonText}>{t('done')}</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const theme = useTheme();
  const { language, t } = useI18n();
  const wanted = listing.direction === 'wanted';
  const { isVerifiedOrganizerListing, officialAccountNameFor } = useVerifiedOrganizers();
  const nation = getNation(listing.nationId);
  const nationImage = getNationImage(listing.nationId);
  const useLogoWatermark = listing.nationId === 'mejeriet';
  const usePhotoWatermark = listing.nationId === 'karneval';
  const listingMeta = [
    getListingOrganizerName(listing),
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
          {wanted && (
            <View style={[styles.badge, styles.wantedBadge]}>
              <ThemedText style={styles.wantedBadgeText}>{t('wantedBadge')}</ThemedText>
            </View>
          )}
          {isVerifiedOrganizerListing(listing) && <VerifiedOrganizerBadge />}
          {officialAccountNameFor(listing.userId) && (
            <OfficialAccountBadge
              name={officialAccountNameFor(listing.userId) as string}
              pictureUrl={listing.sellerAvatarUrl}
            />
          )}
          {(listing.dealType === 'sell' || listing.dealType === 'both') && (
            <View style={[styles.badge, styles.sellBadge]}>
              <ThemedText style={styles.sellBadgeText}>
                {listing.price
                  ? `${wanted ? `${t('wantedPays')} ` : ''}${listing.price} ${t('perTicket')}`
                  : wanted
                    ? t('wantedDealBuy')
                    : t('forSale')}
              </ThemedText>
            </View>
          )}
          {(listing.dealType === 'trade' || listing.dealType === 'both') && (
            <View style={[styles.badge, styles.tradeBadge]}>
              <ThemedText style={styles.tradeBadgeText} numberOfLines={1}>
                {wanted ? t('wantedCanOffer') : t('trade')}: {listing.tradeDescription ?? t('suggestion')}
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
  const nationName = listing ? getListingOrganizerName(listing) : '';
  const titleText = listing ? listing.ticketType : '';
  const isOwnListing = !!user && !!listing && listing.userId === user.id;
  const { isVerifiedOrganizerListing, officialAccountNameFor } = useVerifiedOrganizers();
  const showVerifiedBadge = !!listing && isVerifiedOrganizerListing(listing);
  const officialAccountName = listing ? officialAccountNameFor(listing.userId) : undefined;
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    if (!listing) {
      setRatingSummary(null);
      return;
    }

    let active = true;
    fetchRatingSummary(listing.userId)
      .then((summary) => {
        if (active) setRatingSummary(summary.count > 0 ? summary : null);
      })
      .catch(() => {
        if (active) setRatingSummary(null);
      });

    return () => {
      active = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing) return;
    sheetTranslateY.setValue(36);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [listing, sheetTranslateY]);

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
                    <View style={styles.sellerRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('postedBy')} {listing.sellerName}
                      </ThemedText>
                      {showVerifiedBadge && <VerifiedOrganizerBadge />}
                      {officialAccountName && (
                        <OfficialAccountBadge name={officialAccountName} pictureUrl={listing.sellerAvatarUrl} />
                      )}
                      {ratingSummary && (
                        <View style={styles.sellerRatingBadge}>
                          <ThemedText
                            style={[
                              styles.sellerRatingEmoji,
                              { transform: [{ rotate: `${-(5 - Math.round(ratingSummary.average)) * 45}deg` }] },
                            ]}>
                            👍
                          </ThemedText>
                          <ThemedText style={styles.sellerRatingCount}>({ratingSummary.count})</ThemedText>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.modalStats}>
                  {listing.eventDate && (
                    <Stat label={t('ticketDate')} value={formatListingEventDate(listing.eventDate, language)} />
                  )}
                  <Stat label={t('quantity')} value={`${formatTicketQuantity(listing.quantity)} ${t('pcs')}`} />
                  {(listing.dealType === 'sell' || listing.dealType === 'both') && listing.price && (
                    <Stat
                      label={listing.direction === 'wanted' ? t('wantedPays') : t('price')}
                      value={`${listing.price} ${t('perTicket')}`}
                    />
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
                    <ThemedText style={styles.sectionLabel}>
                      {listing.direction === 'wanted' ? t('wantedCanOffer') : t('tradeWant')}
                    </ThemedText>
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
                      <ThemedText style={styles.primaryActionText}>
                        💬 {listing.direction === 'wanted' ? t('wantedContact') : t('contactSeller')}
                      </ThemedText>
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
    paddingBottom: Spacing.two,
    paddingTop: Spacing.half,
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
  searchRow: {
    flexDirection: 'row',
    gap: FILTER_ROW_GAP,
  },
  searchRowHalf: {
    flex: 1,
  },
  searchRowFill: {
    flex: 1,
  },
  emptyCta: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 999,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  watchButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    width: '100%',
  },
  filterBarRow: {
    flexDirection: 'row',
    gap: FILTER_ROW_GAP,
  },
  filterBarButton: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  filterBarButtonLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  filterBarButtonValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  filterOptionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: Spacing.two,
    maxHeight: '78%',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  filterOptionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  filterOptionSearchInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  filterOptionScroll: {
    flexGrow: 0,
  },
  filterOptionRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 52,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  filterOptionRowText: {
    fontSize: 16,
    fontWeight: '700',
  },
  filterOptionCheck: {
    color: '#E39E72',
    fontSize: 18,
    fontWeight: '800',
  },
  filterOptionEmptyRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  calendarSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  calendarNavButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  calendarNavIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    paddingBottom: Spacing.one,
  },
  calendarWeekdayLabel: {
    flex: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarDayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    flex: 1,
    justifyContent: 'center',
  },
  calendarDayButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: '82%',
    justifyContent: 'center',
    width: '82%',
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  calendarDayTextActive: {
    fontWeight: '800',
  },
  calendarDayDot: {
    borderRadius: 999,
    bottom: 6,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  calendarFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  calendarClearButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  calendarClearButtonText: {
    color: '#9F6A49',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarDoneButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.four,
  },
  calendarDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
  wantedBadge: {
    backgroundColor: '#FDEBDD',
  },
  wantedBadgeText: {
    color: '#9A4A1C',
    fontSize: 12,
    fontWeight: '800',
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
  sellerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  sellerRatingBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  sellerRatingEmoji: {
    fontSize: 13,
  },
  sellerRatingCount: {
    color: '#687283',
    fontSize: 11,
    fontWeight: '700',
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
