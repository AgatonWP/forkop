import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mockListings } from '@/lib/tickets';

export default function TabTwoScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const myListings = mockListings.slice(0, 2);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: safeAreaInsets.top + Spacing.three,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
        },
      ]}>
      <ThemedView style={styles.container}>
        <View style={styles.titleContainer}>
          <ThemedText type="small" themeColor="textSecondary">
            Konto
          </ThemedText>
          <ThemedText style={styles.title}>Mina biljetter</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            Här hamnar dina annonser, matchningar och chattar när auth och Supabase kopplas in.
          </ThemedText>
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Aktiva" value="2" />
          <Metric label="Chattar" value="0" />
          <Metric label="Matchningar" value="3" />
        </View>

        <View style={styles.sectionsWrapper}>
          {myListings.map((listing) => (
            <ThemedView
              key={listing.id}
              type="backgroundElement"
              style={[styles.listingRow, { borderColor: theme.backgroundSelected }]}>
              <View>
                <ThemedText style={styles.listingTitle}>{listing.eventName}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {listing.quantity} st · {listing.price ? `${listing.price} kr` : 'Byte'}
                </ThemedText>
              </View>
              <Pressable style={styles.secondaryButton}>
                <ThemedText style={styles.secondaryButtonText}>Hantera</ThemedText>
              </Pressable>
            </ThemedView>
          ))}
        </View>
      </ThemedView>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.metric}>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  container: {
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  titleContainer: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  title: {
    color: '#E47D43',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 40,
  },
  intro: {
    fontSize: 16,
    lineHeight: 23,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  metric: {
    borderRadius: 8,
    flex: 1,
    padding: Spacing.three,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  sectionsWrapper: {
    gap: Spacing.two,
  },
  listingRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  listingTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#F6E7D9',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#6E3B27',
    fontSize: 13,
    fontWeight: '800',
  },
});
