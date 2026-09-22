import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { checkIsAdmin } from '@/lib/admin';
import { useI18n } from '@/lib/i18n';
import { LOST_ITEM_CATEGORY_EMOJI, LOST_ITEM_CATEGORY_KEY, LostItemCategory, adminDeleteLostItem } from '@/lib/lost-items';
import { ORGANIZERS, getNation } from '@/lib/nations';
import { AdminReport, dismissReport, fetchOpenReports } from '@/lib/reports';
import { adminDeleteListing, fetchAllListingsAdmin, getListingOrganizerName, Listing } from '@/lib/tickets';
import {
  NO_ACCOUNT_WITH_EMAIL,
  VerifiedOrganizerAccount,
  adminListVerifiedOrganizers,
  adminRevokeOrganizer,
  adminVerifyOrganizer,
  useVerifiedOrganizers,
} from '@/lib/verified-organizers';

// "Annat" isn't a real organizer, and the database rejects verifying it.
const VERIFIABLE_ORGANIZERS = ORGANIZERS.filter(({ id }) => id !== 'other');

function useLostItemSubject() {
  const { t } = useI18n();

  return (category: string | null) => {
    if (!category) return '(borttagen anmälan)';

    const known = category as LostItemCategory;
    const label = LOST_ITEM_CATEGORY_KEY[known];

    return label ? `${LOST_ITEM_CATEGORY_EMOJI[known]} ${t(label)}` : category;
  };
}

export default function AdminScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const describeLostItemSubject = useLostItemSubject();
  const { refresh: refreshVerifiedOrganizers } = useVerifiedOrganizers();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [organizers, setOrganizers] = useState<VerifiedOrganizerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyOrganizerId, setVerifyOrganizerId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const canVerify = !!verifyOrganizerId && verifyEmail.trim().length > 0 && !verifying;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reportRows, listingRows, organizerRows] = await Promise.all([
        fetchOpenReports(),
        fetchAllListingsAdmin(),
        adminListVerifiedOrganizers(),
      ]);
      setReports(reportRows);
      setListings(listingRows);
      setOrganizers(organizerRows);
    } catch {
      setError('Kunde inte hämta data.');
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

  async function handleVerify() {
    if (!canVerify || !verifyOrganizerId) return;

    setVerifying(true);
    setVerifyError(null);

    try {
      await adminVerifyOrganizer(verifyEmail.trim(), verifyOrganizerId);
      setVerifyEmail('');
      setVerifyOrganizerId(null);
      refreshVerifiedOrganizers();
      adminListVerifiedOrganizers()
        .then(setOrganizers)
        .catch(() => {
          // The verification itself succeeded; the list just catches up on the next load.
        });
    } catch (err) {
      setVerifyError(
        err instanceof Error && err.message === NO_ACCOUNT_WITH_EMAIL
          ? 'Det finns inget konto med den mejladressen. Arrangören behöver skapa ett konto i appen först.'
          : 'Kunde inte verifiera kontot.',
      );
    } finally {
      setVerifying(false);
    }
  }

  function handleRevoke(account: VerifiedOrganizerAccount) {
    Alert.alert(
      'Återkalla verifiering',
      `${account.email} förlorar märkningen för ${getNation(account.organizerId).name}.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Återkalla',
          style: 'destructive',
          onPress: async () => {
            setBusyId(account.userId);
            try {
              await adminRevokeOrganizer(account.userId);
              setOrganizers((prev) => prev.filter((item) => item.userId !== account.userId));
              refreshVerifiedOrganizers();
            } catch {
              Alert.alert('Fel', 'Kunde inte återkalla verifieringen.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

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
          } catch {
            Alert.alert('Fel', 'Kunde inte ta bort annonsen.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  function handleDeleteLostItem(lostItemId: string) {
    Alert.alert('Ta bort anmälan', 'Anmälan och dess chattar tas bort permanent. Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          setBusyId(lostItemId);
          try {
            await adminDeleteLostItem(lostItemId);
            setReports((prev) => prev.filter((report) => report.lostItemId !== lostItemId));
          } catch {
            Alert.alert('Fel', 'Kunde inte ta bort anmälan.');
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
    } catch {
      Alert.alert('Fel', 'Kunde inte avfärda rapporten.');
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoider}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
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
                    <ThemedText style={styles.sectionTitle}>Verifierade arrangörskonton ({organizers.length})</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Bekräfta alltid via kontaktuppgifterna på arrangörens egen hemsida innan du verifierar, aldrig via
                      uppgifterna i förfrågan.
                    </ThemedText>

                    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        onChangeText={(text) => {
                          setVerifyEmail(text);
                          setVerifyError(null);
                        }}
                        placeholder="Kontots mejladress"
                        placeholderTextColor={theme.textSecondary}
                        style={[
                          styles.input,
                          { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                        ]}
                        value={verifyEmail}
                      />

                      <View style={styles.chipRow}>
                        {VERIFIABLE_ORGANIZERS.map((organizer) => {
                          const selected = organizer.id === verifyOrganizerId;
                          return (
                            <Pressable
                              key={organizer.id}
                              onPress={() => setVerifyOrganizerId(organizer.id)}
                              style={[
                                styles.chip,
                                { borderColor: theme.backgroundSelected },
                                selected && styles.chipSelected,
                              ]}>
                              <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>
                                {organizer.name}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>

                      {verifyError && <ThemedText style={styles.errorText}>{verifyError}</ThemedText>}

                      <Pressable
                        disabled={!canVerify}
                        onPress={handleVerify}
                        style={[styles.primaryButton, !canVerify && styles.buttonDisabled]}>
                        <ThemedText style={styles.primaryButtonText}>{verifying ? 'Verifierar...' : 'Verifiera'}</ThemedText>
                      </Pressable>
                    </View>

                    {organizers.map((account) => (
                      <View
                        key={account.userId}
                        style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                        <ThemedText style={styles.cardTitle}>{getNation(account.organizerId).name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {account.email} · verifierad {account.verifiedAt.toLocaleDateString('sv-SE')}
                        </ThemedText>
                        <Pressable
                          disabled={busyId === account.userId}
                          onPress={() => handleRevoke(account)}
                          style={[styles.destructiveButton, styles.selfEndButton, busyId === account.userId && styles.buttonDisabled]}>
                          <ThemedText style={styles.destructiveButtonText}>Återkalla</ThemedText>
                        </Pressable>
                      </View>
                    ))}
                  </View>

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
                            {report.lostItemId
                              ? `Borttappat: ${describeLostItemSubject(report.subjectName)}`
                              : (report.subjectName ?? '(borttagen annons)')}
                          </ThemedText>
                          {report.subjectNationId && (
                            <ThemedText type="small" themeColor="textSecondary">
                              {getNation(report.subjectNationId).name}
                            </ThemedText>
                          )}
                          <ThemedText type="small">Anledning: {report.reason}</ThemedText>
                          {report.details && (
                            <ThemedText type="small" themeColor="textSecondary">
                              {report.details}
                            </ThemedText>
                          )}
                          <View style={styles.rowButtons}>
                            {report.listingId && (
                              <Pressable
                                disabled={busyId === report.listingId}
                                onPress={() => handleDeleteListing(report.listingId!)}
                                style={[styles.destructiveButton, busyId === report.listingId && styles.buttonDisabled]}>
                                <ThemedText style={styles.destructiveButtonText}>Ta bort annons</ThemedText>
                              </Pressable>
                            )}
                            {report.lostItemId && (
                              <Pressable
                                disabled={busyId === report.lostItemId}
                                onPress={() => handleDeleteLostItem(report.lostItemId!)}
                                style={[styles.destructiveButton, busyId === report.lostItemId && styles.buttonDisabled]}>
                                <ThemedText style={styles.destructiveButtonText}>Ta bort anmälan</ThemedText>
                              </Pressable>
                            )}
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
        </KeyboardAvoidingView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  chipSelected: {
    backgroundColor: '#2F74E0',
    borderColor: '#2F74E0',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: Spacing.one,
    minHeight: 42,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
