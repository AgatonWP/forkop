import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
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
  const { initializing, user, signIn, signOut, signUp } = useAuth();
  const [email, setEmail] = useState('tixet@tixet.se');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
                {activeListings.map((listing) => (
                  <ListingRow key={listing.id} listing={listing} />
                ))}
              </ProfileSection>

              <ProfileSection title="Sålda annonser" count={soldListings.length}>
                {soldListings.map((listing) => (
                  <ListingRow key={listing.id} listing={listing} sold />
                ))}
              </ProfileSection>
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
