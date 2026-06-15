import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Listing, NATIONS, mockListings } from '@/lib/tickets';

const activeListings = mockListings.slice(0, 3);
const soldListings: Listing[] = [
  {
    ...mockListings[4],
    id: 'sold-1',
    isSold: true,
  },
];

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.push('/')} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Profil</ThemedText>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.container}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>S</ThemedText>
            </View>
            <View style={styles.profileCopy}>
              <ThemedText numberOfLines={1} style={styles.profileName}>
                Student
              </ThemedText>
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                student@tixet.se
              </ThemedText>
            </View>
            <Pressable style={[styles.outlineButton, { borderColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.outlineButtonText}>Logga ut</ThemedText>
            </Pressable>
          </View>

          <ProfileSection title="Aktiva annonser" count={activeListings.length}>
            {activeListings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </ProfileSection>

          <ProfileSection title="Sålda annonser" count={soldListings.length}>
            {soldListings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} sold />
            ))}
          </ProfileSection>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function ProfileSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>
        {title} ({count})
      </ThemedText>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

function ListingRow({ listing, sold = false }: { listing: Listing; sold?: boolean }) {
  const theme = useTheme();
  const nationName = NATIONS[listing.nationId] ?? listing.nationId;
  const showTradeBadge = listing.dealType === 'trade' || listing.dealType === 'both';

  return (
    <View
      style={[
        styles.listingRow,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
          opacity: sold ? 0.6 : 1,
        },
      ]}>
      <NationEmblem nationId={listing.nationId} />

      <View style={styles.listingCopy}>
        <ThemedText numberOfLines={1} style={styles.listingTitle}>
          {listing.eventName}
        </ThemedText>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
          {nationName} · {listing.quantity} st
        </ThemedText>
      </View>

      {showTradeBadge && !sold && (
        <View style={styles.tradeBadge}>
          <ThemedText style={styles.tradeBadgeText}>Byte</ThemedText>
        </View>
      )}

      {sold ? (
        <View style={styles.soldBadge}>
          <ThemedText style={styles.soldBadgeText}>Såld</ThemedText>
        </View>
      ) : (
        <View style={styles.actionGroup}>
          <Pressable style={[styles.iconButton, { borderColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.iconButtonText}>✓</ThemedText>
          </Pressable>
          <Pressable style={[styles.iconButton, styles.deleteButton, { borderColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.deleteButtonText}>×</ThemedText>
          </Pressable>
        </View>
      )}
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
    color: '#1D2430',
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 30,
  },
  headerTitle: {
    color: '#1D2430',
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
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EEF0F4',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    color: '#687283',
    fontSize: 26,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: '#1D2430',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  outlineButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#1D2430',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    color: '#1D2430',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sectionRows: {
    gap: Spacing.two,
  },
  listingRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 62,
    padding: Spacing.two,
  },
  listingCopy: {
    flex: 1,
    minWidth: 0,
  },
  listingTitle: {
    color: '#1D2430',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  tradeBadge: {
    backgroundColor: '#4F6FB7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  soldBadge: {
    backgroundColor: '#EEF0F4',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  soldBadgeText: {
    color: '#687283',
    fontSize: 11,
    fontWeight: '800',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconButtonText: {
    color: '#1D2430',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 18,
  },
  deleteButton: {
    backgroundColor: '#FFF7F7',
  },
  deleteButtonText: {
    color: '#C84646',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
  },
});
