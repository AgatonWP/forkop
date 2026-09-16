import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NationEmblem } from '@/components/nation-emblem';
import { RatingModal } from '@/components/rating-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerifiedOrganizerBadge } from '@/components/verified-organizer-badge';
import { BottomTabInset, MaxContentWidth, SecondaryHeaderHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH, authErrorKey, describeAuthError } from '@/lib/auth-errors';
import { useI18n } from '@/lib/i18n';
import { getNation } from '@/lib/nations';
import {
  MAX_SWISH_DIGITS,
  countSwishDigits,
  hasPlausibleSwishLength,
  saveOwnSwishNumber,
} from '@/lib/payment-details';
import { useThemeMode } from '@/lib/theme-mode';
import { Rating, RatingSummary, fetchOwnRatingsForListings, fetchRatingSummary } from '@/lib/ratings';
import {
  Listing,
  SOLD_LISTING_KEEP_MS,
  deleteListing,
  fetchMyListings,
  formatListingEventDate,
  formatTicketQuantity,
  getListingOrganizerName,
  markListingSold,
  restoreListingActive,
} from '@/lib/tickets';
import { useVerifiedOrganizers } from '@/lib/verified-organizers';

const MAX_DISPLAY_NAME_LENGTH = 25;

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { initializing, user, signIn, signInWithApple, signInWithGoogle, signOut, signUp, resetPasswordForEmail } =
    useAuth();
  const { themeMode } = useThemeMode();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ confirmed?: string }>();
  const { verifiedOrganizerIdFor } = useVerifiedOrganizers();
  const verifiedOrganizerId = user ? verifiedOrganizerIdFor(user.id) : undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);

  useEffect(() => {
    if (params.confirmed === '1') {
      setJustConfirmed(true);
    }
  }, [params.confirmed]);
  const [signupFullName, setSignupFullName] = useState('');
  const [signupSwishNumber, setSignupSwishNumber] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Listing | null>(null);
  const [ratingListing, setRatingListing] = useState<Listing | null>(null);
  const [ownRatings, setOwnRatings] = useState<Map<string, Rating>>(new Map());
  const [ownRatingSummary, setOwnRatingSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    if (!user) {
      setOwnRatingSummary(null);
      return;
    }

    let active = true;
    fetchRatingSummary(user.id)
      .then((summary) => {
        if (active) setOwnRatingSummary(summary.count > 0 ? summary : null);
      })
      .catch(() => {
        if (active) setOwnRatingSummary(null);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const loadListings = useCallback(async () => {
    if (!user) {
      setListings([]);
      return;
    }

    setListingsLoading(true);
    setListingsError(null);

    try {
      setListings(await fetchMyListings(user.id));
    } catch {
      setListingsError(t('listingFetchErrorSentence'));
    } finally {
      setListingsLoading(false);
    }
  }, [t, user]);

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

  // Tab screens stay mounted when you switch away, so without this a
  // listing posted elsewhere (e.g. the sell flow) wouldn't show up here
  // until the app fully reloads.
  useFocusEffect(
    useCallback(() => {
      if (!initializing && user) {
        loadListings();
      }
    }, [initializing, loadListings, user]),
  );

  const activeListings = useMemo(() => listings.filter((listing) => !listing.isSold), [listings]);
  const soldListings = useMemo(
    () =>
      listings.filter(
        (listing) => listing.isSold && Date.now() - listing.updatedAt.getTime() < SOLD_LISTING_KEEP_MS,
      ),
    [listings],
  );

  useEffect(() => {
    if (soldListings.length === 0) {
      setOwnRatings(new Map());
      return;
    }

    let active = true;
    fetchOwnRatingsForListings(soldListings.map((listing) => listing.id))
      .then((ratings) => {
        if (active) setOwnRatings(ratings);
      })
      .catch(() => {
        // Non-critical: the "rate buyer" affordance just won't reflect prior state.
      });

    return () => {
      active = false;
    };
  }, [soldListings]);

  // Signing up asks for four things, which is a wall of empty fields to land
  // on. Only the email shows until there is something in it; the rest follows
  // once the choice to use email rather than Apple or Google has been made.
  const signupExpanded = mode === 'signup' && email.trim().length > 0;
  const passwordFieldVisible = mode === 'signin' || signupExpanded;

  // Supabase rejects a short password with an English error; catching it here
  // keeps the requirement visible before the user ever presses the button.
  const passwordTooShort = mode === 'signup' && password.length < MIN_PASSWORD_LENGTH;
  const swishNumberInvalid =
    signupSwishNumber.trim().length > 0 && !hasPlausibleSwishLength(signupSwishNumber);
  // Only complain once the repeat has actually diverged: while it is still a
  // prefix of the password the user is simply mid-word.
  const passwordsDiverged = mode === 'signup' && !password.startsWith(passwordRepeat);
  const passwordsMatch = mode === 'signup' && password.length > 0 && passwordRepeat === password;
  const canSubmitAuth =
    !submitting &&
    !!email.trim() &&
    !!password &&
    !passwordTooShort &&
    !swishNumberInvalid &&
    (mode !== 'signup' || passwordsMatch);

  useEffect(() => {
    // Lets the extra fields slide in rather than appear mid-keystroke.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [signupExpanded]);

  async function handleAuthSubmit() {
    if (!canSubmitAuth) return;

    setSubmitting(true);
    setAuthError(null);
    setConfirmationEmailSent(false);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const { userId, needsEmailConfirmation } = await signUp(email.trim(), password, {
          fullName: signupFullName.trim(),
        });

        if (needsEmailConfirmation) {
          setConfirmationEmailSent(true);
        } else if (signupSwishNumber.trim()) {
          // No confirmation needed, so there's already a session to save with.
          await saveOwnSwishNumber(userId, signupSwishNumber.trim()).catch(() => {
            // Non-critical: the account still exists without it, can be added in Settings.
          });
        }

        setSignupFullName('');
        setSignupSwishNumber('');
      }
      setPassword('');
      setPasswordRepeat('');
      setPasswordVisible(false);
    } catch (error) {
      setAuthError(describeAuthError(error, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    if (submitting) return;

    setSubmitting(true);
    setAuthError(null);

    try {
      await signInWithApple();
    } catch (error) {
      // Prefer a precise reason (no network, rate limited) over the generic
      // provider message, which says nothing the user can act on.
      const key = authErrorKey(error);
      setAuthError(key === 'authGenericError' ? t('appleSignInError') : t(key));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (submitting) return;

    setSubmitting(true);
    setAuthError(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      const key = authErrorKey(error);
      setAuthError(key === 'authGenericError' ? t('googleSignInError') : t(key));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    setAuthError(null);

    try {
      await resetPasswordForEmail(email.trim());
      setResetEmailSent(true);
    } catch (error) {
      const key = authErrorKey(error);
      setAuthError(key === 'authGenericError' ? t('resetPasswordError') : t(key));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    setAuthError(null);

    try {
      await signOut();
    } catch {
      setAuthError(t('signOutError'));
    } finally {
      setSubmitting(false);
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
    } catch {
      setListingsError(t('deleteListingError'));
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleMarkSold() {
    if (!user || !deleteCandidate || pendingListingId || deleteCandidate.isSold) return;

    const listing = deleteCandidate;
    setPendingListingId(listing.id);
    setListingsError(null);

    try {
      const soldListingId = await markListingSold(listing);
      const soldListing = { ...listing, id: soldListingId, isSold: true, updatedAt: new Date() };
      setListings((current) =>
        current.map((item) => (item.id === listing.id ? soldListing : item)),
      );
      setDeleteCandidate(null);
      setRatingListing(soldListing);
    } catch {
      setListingsError(t('markSoldError'));
      setDeleteCandidate(null);
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleRestoreListing() {
    if (!user || !deleteCandidate || pendingListingId || !deleteCandidate.isSold) return;

    const listing = deleteCandidate;
    setPendingListingId(listing.id);
    setListingsError(null);

    try {
      await restoreListingActive(listing);
      setListings((current) =>
        current.map((item) => (item.id === listing.id ? { ...item, isSold: false } : item)),
      );
      setDeleteCandidate(null);
    } catch {
      setListingsError(t('restoreListingError'));
      setDeleteCandidate(null);
    } finally {
      setPendingListingId(null);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerSide} />
          <ThemedText style={styles.headerTitle}>{t('profile')}</ThemedText>
          <View style={styles.headerRight}>
            {user ? (
              <Pressable
                accessibilityLabel="Inställningar"
                hitSlop={16}
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}>
                <Ionicons color={theme.text} name="settings-outline" size={22} />
              </Pressable>
            ) : (
              <View style={styles.settingsButton} />
            )}
          </View>
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
                {user.user_metadata?.avatar_url ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: user.user_metadata.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarText}>
                      {(user.email?.[0] ?? 'T').toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.profileCopy}>
                  <View style={styles.profileNameRow}>
                    <ThemedText numberOfLines={1} style={styles.profileName}>
                      {user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Förköp'}
                    </ThemedText>
                    {ownRatingSummary && (
                      <View style={styles.ownRatingBadge}>
                        <ThemedText
                          style={[
                            styles.ownRatingEmoji,
                            { transform: [{ rotate: `${-(5 - Math.round(ownRatingSummary.average)) * 45}deg` }] },
                          ]}>
                          👍
                        </ThemedText>
                        <ThemedText style={styles.ownRatingCount}>({ownRatingSummary.count})</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                    {user.email}
                  </ThemedText>
                  {verifiedOrganizerId && (
                    <VerifiedOrganizerBadge
                      organizerName={getNation(verifiedOrganizerId).name}
                      style={styles.profileVerifiedBadge}
                    />
                  )}
                </View>
                <Pressable
                  disabled={submitting}
                  onPress={handleSignOut}
                  style={[styles.outlineButton, { borderColor: theme.backgroundSelected, opacity: submitting ? 0.6 : 1 }]}>
                  <ThemedText style={styles.outlineButtonText}>{t('signOut')}</ThemedText>
                </Pressable>
              </View>

              <ProfileSection title={t('activeListings')} count={activeListings.length}>
                {listingsLoading ? (
                  <SectionNotice text={t('loadingListings')} loading />
                ) : activeListings.length > 0 ? (
                  activeListings.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      pending={pendingListingId === listing.id}
                      onDelete={() => setDeleteCandidate(listing)}
                    />
                  ))
                ) : (
                  <SectionNotice text={t('noActiveListings')} />
                )}
              </ProfileSection>

              <ProfileSection title={t('soldListings')} count={soldListings.length}>
                {listingsLoading ? (
                  <SectionNotice text={t('loadingListings')} loading />
                ) : soldListings.length > 0 ? (
                  soldListings.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      pending={pendingListingId === listing.id}
                      sold
                      rating={ownRatings.get(listing.id)}
                      onDelete={() => setDeleteCandidate(listing)}
                      onRate={() => setRatingListing(listing)}
                    />
                  ))
                ) : (
                  <SectionNotice text={t('noSoldListings')} />
                )}
              </ProfileSection>

              {listingsError && <ThemedText style={styles.errorText}>{listingsError}</ThemedText>}
            </>
          ) : (
            <View style={[styles.authPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.authHeader}>
                <ThemedText style={styles.authTitle}>
                  {mode === 'signin' ? t('signIn') : mode === 'signup' ? t('signUp') : t('resetPasswordTitle')}
                </ThemedText>
                {mode !== 'forgot' && (
                  <Pressable
                    onPress={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin');
                      setAuthError(null);
                      setConfirmationEmailSent(false);
                      setSignupFullName('');
                      setSignupSwishNumber('');
                      setPasswordRepeat('');
                      setPasswordVisible(false);
                    }}>
                    <ThemedText style={styles.authSwitch}>
                      {mode === 'signin' ? t('signUp') : t('signIn')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>

              {mode === 'signin' && justConfirmed && (
                <ThemedText type="small" style={styles.confirmationNotice}>
                  {t('accountConfirmedNotice')}
                </ThemedText>
              )}

              {confirmationEmailSent && (
                <ThemedText type="small" style={styles.confirmationNotice}>
                  {t('confirmEmailNotice')}
                </ThemedText>
              )}

              {mode === 'forgot' ? (
                <>
                  {resetEmailSent ? (
                    <ThemedText type="small" style={styles.confirmationNotice}>
                      {t('resetLinkSentNotice')}
                    </ThemedText>
                  ) : (
                    <>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('resetPasswordInstructions')}
                      </ThemedText>
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

                      {authError && <ThemedText style={styles.errorText}>{authError}</ThemedText>}

                      <Pressable
                        disabled={submitting || !email.trim()}
                        onPress={handleForgotPassword}
                        style={[
                          styles.primaryButton,
                          { opacity: submitting || !email.trim() ? 0.55 : 1 },
                        ]}>
                        <ThemedText style={styles.primaryButtonText}>
                          {submitting ? t('wait') : t('sendResetLink')}
                        </ThemedText>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    onPress={() => {
                      setMode('signin');
                      setAuthError(null);
                      setResetEmailSent(false);
                    }}>
                    <ThemedText style={styles.authSwitch}>{t('backToSignIn')}</ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(text) => {
                      setEmail(text);
                      setConfirmationEmailSent(false);
                    }}
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
                  {passwordFieldVisible && (
                    <View style={styles.passwordField}>
                      <TextInput
                        autoCapitalize="none"
                        onChangeText={setPassword}
                        placeholder={mode === 'signup' ? t('passwordSignupPlaceholder') : t('password')}
                        placeholderTextColor={theme.textSecondary}
                        secureTextEntry={!passwordVisible}
                        style={[
                          styles.input,
                          styles.passwordInput,
                          {
                            backgroundColor: theme.background,
                            borderColor: theme.backgroundSelected,
                            color: theme.text,
                          },
                        ]}
                        value={password}
                      />
                      <Pressable
                        accessibilityLabel={t(passwordVisible ? 'hidePassword' : 'showPassword')}
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => setPasswordVisible((visible) => !visible)}
                        style={styles.passwordToggle}>
                        <Ionicons
                          color={theme.textSecondary}
                          name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                        />
                      </Pressable>
                    </View>
                  )}

                  {passwordTooShort && password.length > 0 && (
                    <ThemedText type="small" style={styles.fieldHint}>
                      {t('passwordMinHint')}
                    </ThemedText>
                  )}

                  {signupExpanded && password.length > 0 && (
                    <>
                      <View style={styles.passwordField}>
                        <TextInput
                          autoCapitalize="none"
                          onChangeText={setPasswordRepeat}
                          placeholder={t('repeatPasswordPlaceholder')}
                          placeholderTextColor={theme.textSecondary}
                          secureTextEntry={!passwordVisible}
                          style={[
                            styles.input,
                            styles.passwordInput,
                            {
                              backgroundColor: theme.background,
                              borderColor: passwordsMatch ? '#3F9A6A' : theme.backgroundSelected,
                              color: theme.text,
                            },
                          ]}
                          value={passwordRepeat}
                        />
                        {passwordsMatch && (
                          <View style={styles.passwordToggle}>
                            <Ionicons color="#3F9A6A" name="checkmark-circle" size={20} />
                          </View>
                        )}
                      </View>

                      {passwordsDiverged && (
                        <ThemedText type="small" style={styles.fieldHint}>
                          {t('passwordsDoNotMatch')}
                        </ThemedText>
                      )}
                    </>
                  )}

                  {mode === 'signin' && (
                    <Pressable
                      onPress={() => {
                        setMode('forgot');
                        setAuthError(null);
                        setResetEmailSent(false);
                      }}
                      style={styles.forgotPasswordLink}>
                      <ThemedText style={styles.authSwitch}>{t('forgotPassword')}</ThemedText>
                    </Pressable>
                  )}

                  {signupExpanded && (
                    <>
                      <TextInput
                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                        onChangeText={(text) => setSignupFullName(text.replace(/[^\p{L}\s]/gu, ''))}
                        placeholder={t('displayNameOptionalPlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        style={[
                          styles.input,
                          { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                        ]}
                        value={signupFullName}
                      />
                      <TextInput
                        keyboardType="phone-pad"
                        onChangeText={(text) => {
                          const cleaned = text.replace(/[^\d\s+-]/g, '');
                          // Stop at 15 digits rather than letting a typo run on:
                          // no phone number anywhere is longer than that.
                          if (countSwishDigits(cleaned) <= MAX_SWISH_DIGITS) {
                            setSignupSwishNumber(cleaned);
                          }
                        }}
                        placeholder={t('swishNumberOptionalPlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        style={[
                          styles.input,
                          { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                        ]}
                        value={signupSwishNumber}
                      />

                      {swishNumberInvalid && (
                        <ThemedText type="small" style={styles.fieldHint}>
                          {t('swishNumberLengthHint')}
                        </ThemedText>
                      )}
                    </>
                  )}

                  {authError && <ThemedText style={styles.errorText}>{authError}</ThemedText>}

                  <Pressable
                    disabled={!canSubmitAuth}
                    onPress={handleAuthSubmit}
                    style={[styles.primaryButton, { opacity: canSubmitAuth ? 1 : 0.55 }]}>
                    <ThemedText style={styles.primaryButtonText}>
                      {submitting ? t('wait') : mode === 'signin' ? t('signIn') : t('signUp')}
                    </ThemedText>
                  </Pressable>

                  {Platform.OS === 'ios' && (
                    <>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.authDivider}>
                        {t('orDivider')}
                      </ThemedText>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={
                          mode === 'signup'
                            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                        }
                        buttonStyle={
                          themeMode === 'dark'
                            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                        }
                        cornerRadius={8}
                        onPress={handleAppleSignIn}
                        style={styles.appleButton}
                      />
                      <Pressable
                        disabled={submitting}
                        onPress={handleGoogleSignIn}
                        style={({ pressed }) => [
                          styles.googleButton,
                          {
                            // Google's white button carries a border so it reads as a
                            // button on light backgrounds; on dark it stands on its own.
                            borderColor: themeMode === 'dark' ? '#FFFFFF' : '#747775',
                            opacity: pressed || submitting ? 0.7 : 1,
                          },
                        ]}>
                        <Image
                          contentFit="contain"
                          source={require('@/assets/images/google-g.png')}
                          style={styles.googleLogo}
                        />
                        <ThemedText style={styles.googleButtonText}>
                          {mode === 'signup' ? t('signUpWithGoogle') : t('signInWithGoogle')}
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <ListingActionModal
        listing={deleteCandidate}
        pending={pendingListingId === deleteCandidate?.id}
        onCancel={() => setDeleteCandidate(null)}
        onDelete={handleDeleteListing}
        onMarkSold={handleMarkSold}
        onRestore={handleRestoreListing}
      />
      <RatingModal
        listing={ratingListing}
        onClose={() => setRatingListing(null)}
        onSubmitted={() => {
          if (!ratingListing) return;
          fetchOwnRatingsForListings([ratingListing.id]).then((ratings) => {
            const rating = ratings.get(ratingListing.id);
            if (!rating) return;
            setOwnRatings((current) => new Map(current).set(ratingListing.id, rating));
          });
        }}
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
  rating,
  onDelete,
  onRate,
}: {
  listing: Listing;
  sold?: boolean;
  pending?: boolean;
  rating?: Rating;
  onDelete: () => void;
  onRate?: () => void;
}) {
  const theme = useTheme();
  const { language, t } = useI18n();
  const nationName = getListingOrganizerName(listing);
  const listingMeta = [
    nationName,
    listing.eventDate ? formatListingEventDate(listing.eventDate, language) : null,
    `${formatTicketQuantity(listing.quantity)} ${t('pcs')}`,
  ].filter(Boolean).join(' · ');
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
          {listingMeta}
        </ThemedText>
      </View>

      {showTradeBadge && !sold && (
        <View style={styles.tradeBadge}>
          <ThemedText style={styles.tradeBadgeText}>{t('trade')}</ThemedText>
        </View>
      )}

      {sold ? (
        <>
          {rating ? (
            <View style={styles.ratedBadge}>
              <ThemedText
                style={[styles.ratedBadgeEmoji, { transform: [{ rotate: `${-(5 - rating.score) * 45}deg` }] }]}>
                👍
              </ThemedText>
            </View>
          ) : (
            onRate && (
              <Pressable onPress={onRate} style={styles.rateButton}>
                <ThemedText style={styles.rateButtonText}>{t('rateBuyerAction')}</ThemedText>
              </Pressable>
            )
          )}
          <View style={styles.soldBadge}>
            <ThemedText style={styles.soldBadgeText}>{t('sold')}</ThemedText>
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

function ListingActionModal({
  listing,
  pending,
  onCancel,
  onDelete,
  onMarkSold,
  onRestore,
}: {
  listing: Listing | null;
  pending: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onMarkSold: () => void;
  onRestore: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const showMarkSold = !!listing && !listing.isSold;
  const showRestore = !!listing && listing.isSold;

  return (
    <Modal
      visible={!!listing}
      animationType="fade"
      transparent
      onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.confirmCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.confirmTitle}>{t('manageListing')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.confirmCopy}>
            {listing ? listing.eventName : ''}
          </ThemedText>
          {showMarkSold && (
            <Pressable
              disabled={pending}
              onPress={onMarkSold}
              style={[styles.confirmButton, styles.markSoldButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.markSoldButtonText}>
                {pending ? t('wait') : t('markAsSold')}
              </ThemedText>
            </Pressable>
          )}
          {showRestore && (
            <Pressable
              disabled={pending}
              onPress={onRestore}
              style={[styles.confirmButton, styles.markSoldButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.markSoldButtonText}>
                {pending ? t('wait') : t('restoreListing')}
              </ThemedText>
            </Pressable>
          )}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={pending}
              onPress={onCancel}
              style={[styles.confirmButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.cancelButtonText}>{t('cancel')}</ThemedText>
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={onDelete}
              style={[styles.confirmButton, styles.confirmDeleteButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.confirmDeleteText}>
                {pending ? t('wait') : t('delete')}
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
    justifyContent: 'center',
    minHeight: SecondaryHeaderHeight,
    paddingHorizontal: Spacing.three,
  },
  headerSide: {
    width: 92,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
    width: 92,
  },
  settingsButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  settingsButtonPressed: {
    opacity: 0.65,
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
  profileVerifiedBadge: {
    marginTop: Spacing.one,
  },
  profileNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  profileName: {
    flexShrink: 1,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  ownRatingBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  ownRatingEmoji: {
    fontSize: 15,
  },
  ownRatingCount: {
    color: '#9AA3B2',
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  authDivider: {
    alignSelf: 'center',
  },
  appleButton: {
    height: 46,
    width: '100%',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.one,
    height: 46,
    justifyContent: 'center',
    width: '100%',
  },
  googleLogo: {
    height: 18,
    width: 18,
  },
  googleButtonText: {
    color: '#1F1F1F',
    fontSize: 17,
    fontWeight: '600',
  },
  passwordField: {
    justifyContent: 'center',
    position: 'relative',
  },
  passwordInput: {
    // Room for the eye, so a long password never runs under it.
    paddingRight: 44,
  },
  passwordToggle: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
  },
  fieldHint: {
    color: '#B4553B',
    marginTop: -Spacing.one,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
  },
  authSwitch: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmationNotice: {
    backgroundColor: '#EAF0FF',
    borderRadius: 8,
    color: '#2E4C9C',
    fontWeight: '700',
    padding: Spacing.two,
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
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
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
  rateButton: {
    backgroundColor: '#1D2430',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ratedBadge: {
    alignItems: 'center',
    backgroundColor: '#DCF3E4',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  ratedBadgeEmoji: {
    fontSize: 14,
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
  markSoldButton: {
    backgroundColor: '#1D2430',
    borderColor: '#1D2430',
  },
  markSoldButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelButtonText: {
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
