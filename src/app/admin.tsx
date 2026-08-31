import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkIsAdmin } from '@/lib/admin';
import { getNation } from '@/lib/nations';
import { AdminReport, dismissReport, fetchOpenReports } from '@/lib/reports';
import { adminDeleteListing, fetchAllListingsAdmin, getListingOrganizerName, Listing } from '@/lib/tickets';

export default function AdminScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reportRows, listingRows] = await Promise.all([fetchOpenReports(), fetchAllListingsAdmin()]);
      setReports(reportRows);
      setListings(listingRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkIsAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        if (isAdmin) load();
      })
      .catch(() => setAuthorized(false));
  }, [load]);

  function handleDeleteListing(listingId: string) {
    Alert.alert('Ta bort annons', 'Annonsen och alla dess chattar tas bort permanent. Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          setBusyId(listingId);
          try {
            await adminDeleteListing(listingId);
            setListings((prev) => prev.filter((listing) => listing.id !== listingId));
            setReports((prev) => prev.filter((report) => report.listingId !== listingId));
          } catch (err) {
            Alert.alert('Fel', err instanceof Error ? err.message : 'Kunde inte ta bort annonsen.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function handleDismissReport(reportId: string) {
    setBusyId(reportId);
    try {
      await dismissReport(reportId);
      setReports((prev) => prev.filter((report) => report.id !== reportId));
    } catch (err) {
      Alert.alert('Fel', err instanceof Error ? err.message : 'Kunde inte avfärda rapporten.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Admin</ThemedText>
        </View>
      </SafeAreaView>

      {authorized === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : authorized === false ? (
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Du har inte tillgång till den här sidan.</ThemedText>
        </View>
      ) : (
        <ScrollView
          style={[styles.scrollView, { backgroundColor: theme.background }]}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
          ]}>
          <View style={styles.container}>
            {loading ? (
              <ActivityIndicator color={theme.textSecondary} />
            ) : error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : (
              <>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Rapporterade annonser ({reports.length})</ThemedText>

                  {reports.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Inga öppna rapporter.
                    </ThemedText>
                  ) : (
                    reports.map((report) => (
                      <View
                        key={report.id}
                        style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                        <ThemedText style={styles.cardTitle}>
                          {report.listingEventName ?? '(borttagen annons)'}
                        </ThemedText>
                        {report.listingNationId && (
                          <ThemedText type="small" themeColor="textSecondary">
                            {getNation(report.listingNationId).name}
                          </ThemedText>
                        )}
                        <ThemedText type="small">Anledning: {report.reason}</ThemedText>
                        {report.details && (
                          <ThemedText type="small" themeColor="textSecondary">
                            {report.details}
                          </ThemedText>
                        )}
                        <View style={styles.rowButtons}>
                          <Pressable
                            disabled={busyId === report.listingId}
                            onPress={() => handleDeleteListing(report.listingId)}
                            style={[styles.destructiveButton, busyId === report.listingId && styles.buttonDisabled]}>
                            <ThemedText style={styles.destructiveButtonText}>Ta bort annons</ThemedText>
                          </Pressable>
                          <Pressable
                            disabled={busyId === report.id}
                            onPress={() => handleDismissReport(report.id)}
                            style={[styles.secondaryButton, busyId === report.id && styles.buttonDisabled]}>
                            <ThemedText style={styles.secondaryButtonText}>Avfärda rapport</ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Alla annonser ({listings.length})</ThemedText>

                  {listings.map((listing) => (
                    <View
                      key={listing.id}
                      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                      <ThemedText style={styles.cardTitle}>{listing.eventName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {getListingOrganizerName(listing)} · {listing.ticketType} · {listing.isSold ? 'Såld' : 'Aktiv'}
                      </ThemedText>
                      <Pressable
                        disabled={busyId === listing.id}
                        onPress={() => handleDeleteListing(listing.id)}
                        style={[styles.destructiveButton, styles.selfEndButton, busyId === listing.id && styles.buttonDisabled]}>
                        <ThemedText style={styles.destructiveButtonText}>Ta bort</ThemedText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
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
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
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
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.one,
    padding: Spacing.three,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  destructiveButton: {
    alignItems: 'center',
    borderColor: '#C84646',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: Spacing.three,
  },
  selfEndButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
  destructiveButtonText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#B7BEC9',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: Spacing.three,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
