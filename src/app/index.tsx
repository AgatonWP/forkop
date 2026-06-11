import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  EVENT_CATEGORIES,
  EventCategory,
  Listing,
  NATIONS,
  formatRelativeTime,
  getEventCategory,
  mockListings,
} from '@/lib/tickets';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<EventCategory>('all');
  const [dealFilter, setDealFilter] = useState<'all' | 'sell' | 'trade'>('all');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mockListings
      .filter((listing) => !listing.isSold)
      .filter((listing) => category === 'all' || getEventCategory(listing) === category)
      .filter((listing) => {
        if (dealFilter === 'all') return true;
        if (dealFilter === 'sell') return listing.dealType === 'sell' || listing.dealType === 'both';
        return listing.dealType === 'trade' || listing.dealType === 'both';
      })
      .filter((listing) => {
        if (!query) return true;
        return (
          listing.eventName.toLowerCase().includes(query) ||
          (NATIONS[listing.nationId] ?? listing.nationId).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [category, dealFilter, search]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <View style={styles.logoBlock}>
            <Image
              source={require('@/assets/images/tixet-logo.png')}
              resizeMode="contain"
              style={styles.logoImage}
            />
          </View>
          <Pressable style={styles.createButton}>
            <ThemedText style={styles.createButtonText}>Lägg upp</ThemedText>
          </Pressable>
        </View>

        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {EVENT_CATEGORIES.map((item) => (
                    <FilterChip
                      key={item.id}
                      label={item.label}
                      active={category === item.id}
                      onPress={() => setCategory(item.id)}
                    />
                  ))}
                </View>
              </ScrollView>

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

              <ThemedText type="small" themeColor="textSecondary">
                {filteredListings.length} aktiva annonser
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => setSelectedListing(item)} />
          )}
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>Inga biljetter hittades</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                Prova en bredare sökning eller byt filter.
              </ThemedText>
            </ThemedView>
          }
        />
      </SafeAreaView>

      <ListingModal listing={selectedListing} onClose={() => setSelectedListing(null)} />
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
  const nationName = NATIONS[listing.nationId] ?? listing.nationId;

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
        <View style={styles.emblem}>
          <ThemedText style={styles.emblemText}>{nationName.slice(0, 1)}</ThemedText>
        </View>
        <View style={styles.cardTitleBlock}>
          <View style={styles.titleRow}>
            <ThemedText numberOfLines={1} style={styles.cardTitle}>
              {listing.eventName}
            </ThemedText>
            <View style={styles.quantityPill}>
              <ThemedText style={styles.quantityText}>{listing.quantity} st</ThemedText>
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
              {listing.price ? `${listing.price} kr` : 'Säljes'}
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

function ListingModal({ listing, onClose }: { listing: Listing | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nationName = listing ? NATIONS[listing.nationId] ?? listing.nationId : '';

  return (
    <Modal animationType="slide" transparent visible={!!listing} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
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
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {nationName}
                  </ThemedText>
                  <ThemedText style={styles.modalTitle}>{listing.eventName}</ThemedText>
                </View>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>Stäng</ThemedText>
                </Pressable>
              </View>

              <View style={styles.modalStats}>
                <Stat label="Antal" value={`${listing.quantity} st`} />
                <Stat label="Typ" value={listing.ticketType} />
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

              <Pressable style={styles.primaryAction}>
                <ThemedText style={styles.primaryActionText}>Kontakta säljaren</ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    shadowColor: '#E39E72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  logoBlock: {
    height: 48,
    justifyContent: 'center',
    width: 124,
  },
  logoImage: {
    height: 48,
    width: 124,
  },
  createButton: {
    backgroundColor: '#1D2430',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  emblem: {
    alignItems: 'center',
    backgroundColor: '#FFC8A54D',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emblemText: {
    color: '#7A4A2F',
    fontSize: 16,
    fontWeight: '800',
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#D5DAE2',
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  closeButton: {
    backgroundColor: '#F0F1F4',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#1D2430',
    fontSize: 13,
    fontWeight: '800',
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
});
