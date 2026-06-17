import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  Listing,
  NATIONS,
  deleteListing,
  fetchMyListings,
  formatTicketQuantity,
  markListingSold,
} from '@/lib/tickets';

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { initializing, user, signIn, signOut, signUp } = useAuth();
  const [email, setEmail] = useState('tixet@tixet.se');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Listing | null>(null);

  const loadListings = useCallback(async () => {
    if (!user) {
      setListings([]);
      return;
    }

    setListingsLoading(true);
    setListingsError(null);

    try {
      setListings(await fetchMyListings(user.id));
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : 'Kunde inte hämta annonser.');
    } finally {
      setListingsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!initializing && user) {
      loadListings();
    } else if (!user) {
      setListings([]);
      setListingsLoading(false);
      setListingsError(null);
      setDeleteCandidate(null);
      setPendingListingId(null);
    }
  }, [initializing, loadListings, user]);

  const activeListings = useMemo(() => listings.filter((listing) => !listing.isSold), [listings]);
  const soldListings = useMemo(() => listings.filter((listing) => listing.isSold), [listings]);

  async function handleAuthSubmit() {
    if (!email.trim() || !password) return;

    setSubmitting(true);
    setAuthError(null);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Något gick fel. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    setAuthError(null);

    try {
      await signOut();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Kunde inte logga ut.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkSold(listing: Listing) {
    if (!user || pendingListingId) return;

    setPendingListingId(listing.id);
    setListingsError(null);

    try {
      await markListingSold(listing.id, user.id);
      setListings((current) =>
        current.map((item) => (item.id === listing.id ? { ...item, isSold: true } : item)),
      );
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : 'Kunde inte markera annonsen som såld.');
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleDeleteListing() {
    if (!user || !deleteCandidate || pendingListingId) return;

    const listingId = deleteCandidate.id;
    setPendingListingId(listingId);
    setListingsError(null);

    try {
      await deleteListing(listingId, user.id);
      setListings((current) => current.filter((item) => item.id !== listingId));
      setDeleteCandidate(null);
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : 'Kunde inte ta bort annonsen.');
    } finally {
      setPendingListingId(null);
    }
  }

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
          {initializing ? (
            <View style={[styles.authPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : user ? (
            <>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarText}>
                    {(user.email?.[0] ?? 'T').toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.profileCopy}>
                  <ThemedText numberOfLines={1} style={styles.profileName}>
                    {user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Tixet'}
                  </ThemedText>
                  <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                    {user.email}
                  </ThemedText>
                </View>
                <Pressable
                  disabled={submitting}
                  onPress={handleSignOut}
                  style={[styles.outlineButton, { borderColor: theme.backgroundSelected, opacity: submitting ? 0.6 : 1 }]}>
                  <ThemedText style={styles.outlineButtonText}>Logga ut</ThemedText>
                </Pressable>
              </View>

              <ProfileSection title="Aktiva annonser" count={activeListings.length}>
                {listingsLoading ? (
                  <SectionNotice text="Hämtar annonser..." loading />
                ) : activeListings.length > 0 ? (
                  activeListings.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      pending={pendingListingId === listing.id}
                      onDelete={() => setDeleteCandidate(listing)}
                      onMarkSold={() => handleMarkSold(listing)}
                    />
                  ))
                ) : (
                  <SectionNotice text="Du har inga aktiva annonser." />
                )}
              </ProfileSection>

              <ProfileSection title="Sålda annonser" count={soldListings.length}>
                {listingsLoading ? (
                  <SectionNotice text="Hämtar annonser..." loading />
                ) : soldListings.length > 0 ? (
                  soldListings.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      pending={pendingListingId === listing.id}
                      sold
                      onDelete={() => setDeleteCandidate(listing)}
                    />
                  ))
                ) : (
                  <SectionNotice text="Du har inga sålda annonser." />
                )}
              </ProfileSection>

              {listingsError && <ThemedText style={styles.errorText}>{listingsError}</ThemedText>}
            </>
          ) : (
            <View style={[styles.authPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.authHeader}>
                <ThemedText style={styles.authTitle}>
                  {mode === 'signin' ? 'Logga in' : 'Skapa konto'}
                </ThemedText>
                <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                  <ThemedText style={styles.authSwitch}>
                    {mode === 'signin' ? 'Skapa konto' : 'Logga in'}
                  </ThemedText>
                </Pressable>
              </View>

              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                  },
                ]}
                value={email}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="Lösenord"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                  },
                ]}
                value={password}
              />

              {authError && <ThemedText style={styles.errorText}>{authError}</ThemedText>}

              <Pressable
                disabled={submitting || !email.trim() || !password}
                onPress={handleAuthSubmit}
                style={[
                  styles.primaryButton,
                  { opacity: submitting || !email.trim() || !password ? 0.55 : 1 },
                ]}>
                <ThemedText style={styles.primaryButtonText}>
                  {submitting ? 'Vänta...' : mode === 'signin' ? 'Logga in' : 'Skapa konto'}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <ConfirmDeleteModal
        listing={deleteCandidate}
        pending={pendingListingId === deleteCandidate?.id}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteListing}
      />
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

function SectionNotice({ text, loading = false }: { text: string; loading?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.noticeRow, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      {loading && <ActivityIndicator size="small" color={theme.textSecondary} />}
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

function ListingRow({
  listing,
  sold = false,
  pending = false,
  onDelete,
  onMarkSold,
}: {
  listing: Listing;
  sold?: boolean;
  pending?: boolean;
  onDelete: () => void;
  onMarkSold?: () => void;
}) {
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
          {nationName} · {formatTicketQuantity(listing.quantity)} st
        </ThemedText>
      </View>

      {showTradeBadge && !sold && (
        <View style={styles.tradeBadge}>
          <ThemedText style={styles.tradeBadgeText}>Byte</ThemedText>
        </View>
      )}

      {sold ? (
        <>
          <View style={styles.soldBadge}>
            <ThemedText style={styles.soldBadgeText}>Såld</ThemedText>
          </View>
          <Pressable
            accessibilityLabel="Ta bort annons"
            disabled={pending}
            onPress={onDelete}
            style={[styles.iconButton, styles.deleteButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
            <ThemedText style={styles.deleteButtonText}>×</ThemedText>
          </Pressable>
        </>
      ) : (
        <View style={styles.actionGroup}>
          <Pressable
            accessibilityLabel="Markera annons som såld"
            disabled={pending}
            onPress={onMarkSold}
            style={[styles.iconButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
            <ThemedText style={styles.iconButtonText}>✓</ThemedText>
          </Pressable>
          <Pressable
            accessibilityLabel="Ta bort annons"
            disabled={pending}
            onPress={onDelete}
            style={[styles.iconButton, styles.deleteButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
            <ThemedText style={styles.deleteButtonText}>×</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ConfirmDeleteModal({
  listing,
  pending,
  onCancel,
  onConfirm,
}: {
  listing: Listing | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={!!listing}
      animationType="fade"
      transparent
      onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.confirmCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.confirmTitle}>Ta bort annons?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.confirmCopy}>
            {listing ? `${listing.eventName} tas bort permanent.` : ''}
          </ThemedText>
          <View style={styles.confirmActions}>
            <Pressable
              disabled={pending}
              onPress={onCancel}
              style={[styles.confirmButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.cancelButtonText}>Avbryt</ThemedText>
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={onConfirm}
              style={[styles.confirmButton, styles.confirmDeleteButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.confirmDeleteText}>
                {pending ? 'Tar bort...' : 'Ta bort'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  authPanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  authHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  authTitle: {
    color: '#1D2430',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  authSwitch: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
  noticeRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
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
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: '#1D243080',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  confirmCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    maxWidth: 360,
    padding: Spacing.four,
    width: '100%',
  },
  confirmTitle: {
    color: '#1D2430',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  confirmCopy: {
    lineHeight: 19,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  cancelButtonText: {
    color: '#1D2430',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmDeleteButton: {
    backgroundColor: '#C84646',
    borderColor: '#C84646',
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
