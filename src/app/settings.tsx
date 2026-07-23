import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pickAndUploadAvatar } from '@/lib/avatar';
import { useAuth } from '@/lib/auth';
import { Language, useI18n } from '@/lib/i18n';
import { disablePushNotifications, getPushEnabled, registerForPushNotifications } from '@/lib/push-notifications';
import { LU_STUDENT_EMAIL_REGEX, requestStudentVerification, verifyStudentCode } from '@/lib/student-verification';
import { supabase } from '@/lib/supabase';
import { ThemeMode, useThemeMode } from '@/lib/theme-mode';

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { themeMode, setThemeMode } = useThemeMode();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSubmitting, setPushSubmitting] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const isStudentVerified = user?.user_metadata?.student_verified === true;
  const verifiedEmail = user?.user_metadata?.student_verified_email as string | undefined;
  const [verificationStep, setVerificationStep] = useState<'email' | 'code'>('email');
  const [luEmail, setLuEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [sendCodeError, setSendCodeError] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyCodeError, setVerifyCodeError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    setAvatarUrl(user?.user_metadata?.avatar_url ?? null);
    setFullName(user?.user_metadata?.full_name ?? '');
  }, [user]);

  useEffect(() => {
    if (!user) return;

    getPushEnabled(user.id)
      .then(setPushEnabled)
      .catch(() => setPushEnabled(false))
      .finally(() => setPushLoading(false));
  }, [user]);

  async function handleChangeAvatar() {
    if (!user || avatarUploading) return;

    setAvatarUploading(true);
    setAvatarError(null);

    try {
      const url = await pickAndUploadAvatar(user.id);
      if (url) setAvatarUrl(url);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : t('avatarChangeError'));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveName() {
    if (!user || nameSaving || !fullName.trim()) return;

    setNameSaving(true);
    setNameError(null);
    setNameSaved(false);

    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });

      if (error) throw new Error(error.message);
      setNameSaved(true);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : t('nameSaveError'));
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSendVerificationCode() {
    const trimmedEmail = luEmail.trim();
    if (sendingCode || resendCooldown > 0 || !LU_STUDENT_EMAIL_REGEX.test(trimmedEmail)) return;

    setSendingCode(true);
    setSendCodeError(null);

    try {
      await requestStudentVerification(trimmedEmail);
      setPendingEmail(trimmedEmail);
      setVerificationCode('');
      setVerifyCodeError(null);
      setVerificationStep('code');
      setResendCooldown(60);
    } catch (error) {
      setSendCodeError(error instanceof Error ? error.message : t('verificationGenericError'));
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    const trimmedCode = verificationCode.trim();
    if (verifyingCode || trimmedCode.length !== 6) return;

    setVerifyingCode(true);
    setVerifyCodeError(null);

    try {
      await verifyStudentCode(trimmedCode);
    } catch (error) {
      setVerifyCodeError(error instanceof Error ? error.message : t('verificationGenericError'));
    } finally {
      setVerifyingCode(false);
    }
  }

  function handleUseDifferentEmail() {
    setVerificationStep('email');
    setVerificationCode('');
    setVerifyCodeError(null);
  }

  async function handleTogglePush(next: boolean) {
    if (!user || pushSubmitting) return;

    setPushSubmitting(true);
    setPushError(null);

    try {
      if (next) {
        await registerForPushNotifications(user.id);
      } else {
        await disablePushNotifications(user.id);
      }
      setPushEnabled(next);
    } catch (error) {
      setPushError(error instanceof Error ? error.message : t('pushToggleError'));
    } finally {
      setPushSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('settingsTitle')}</ThemedText>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}>
        <View style={styles.container}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('profile')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.avatarRow}>
                <Pressable disabled={avatarUploading} onPress={handleChangeAvatar} style={styles.avatarTouchable}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText style={styles.avatarFallbackText} themeColor="textSecondary">
                        {(fullName?.[0] ?? user?.email?.[0] ?? 'T').toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  {avatarUploading && (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
                <View style={styles.avatarCopy}>
                  <ThemedText style={styles.avatarTitle}>{t('profilePictureLabel')}</ThemedText>
                  <Pressable disabled={avatarUploading} onPress={handleChangeAvatar}>
                    <ThemedText style={styles.avatarAction}>
                      {avatarUploading ? t('uploadingLabel') : t('changePicture')}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
              {avatarError && <ThemedText style={styles.errorText}>{avatarError}</ThemedText>}

              <View style={styles.nameRow}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('displayNameLabel')}
                </ThemedText>
                <View style={styles.nameInputRow}>
                  <TextInput
                    onChangeText={(text) => {
                      setFullName(text);
                      setNameSaved(false);
                    }}
                    placeholder={t('namePlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      styles.nameInput,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={fullName}
                  />
                  <Pressable
                    disabled={nameSaving || !fullName.trim()}
                    onPress={handleSaveName}
                    style={[styles.saveButton, { opacity: nameSaving || !fullName.trim() ? 0.55 : 1 }]}>
                    <ThemedText style={styles.saveButtonText}>
                      {nameSaving ? t('savingLabel') : nameSaved ? t('savedLabel') : t('saveNameButton')}
                    </ThemedText>
                  </Pressable>
                </View>
                {nameError && <ThemedText style={styles.errorText}>{nameError}</ThemedText>}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('studentVerificationSection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              {isStudentVerified ? (
                <View style={styles.verifiedRow}>
                  <Ionicons color="#4F6FB7" name="checkmark-circle" size={22} />
                  <View style={styles.avatarCopy}>
                    <ThemedText style={styles.switchTitle}>{t('verifiedStudentLabel')}</ThemedText>
                    {verifiedEmail && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {verifiedEmail}
                      </ThemedText>
                    )}
                  </View>
                </View>
              ) : verificationStep === 'email' ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('studentVerificationCopy')}
                  </ThemedText>
                  <View style={styles.nameInputRow}>
                    <TextInput
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={(text) => {
                        setLuEmail(text);
                        setSendCodeError(null);
                      }}
                      placeholder={t('luEmailPlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        styles.nameInput,
                        { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                      ]}
                      value={luEmail}
                    />
                    <Pressable
                      disabled={sendingCode || resendCooldown > 0 || !LU_STUDENT_EMAIL_REGEX.test(luEmail.trim())}
                      onPress={handleSendVerificationCode}
                      style={[
                        styles.saveButton,
                        {
                          opacity:
                            sendingCode || resendCooldown > 0 || !LU_STUDENT_EMAIL_REGEX.test(luEmail.trim())
                              ? 0.55
                              : 1,
                        },
                      ]}>
                      <ThemedText style={styles.saveButtonText}>
                        {sendingCode
                          ? t('sendingLabel')
                          : resendCooldown > 0
                            ? `${t('resendCodeLabel')} (${resendCooldown}s)`
                            : t('sendCodeButton')}
                      </ThemedText>
                    </Pressable>
                  </View>
                  {sendCodeError && <ThemedText style={styles.errorText}>{sendCodeError}</ThemedText>}
                </>
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('codeSentNotice')} {pendingEmail}
                  </ThemedText>
                  <View style={styles.nameInputRow}>
                    <TextInput
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={(text) => {
                        setVerificationCode(text.replace(/[^0-9]/g, ''));
                        setVerifyCodeError(null);
                      }}
                      placeholder={t('codePlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        styles.nameInput,
                        { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                      ]}
                      value={verificationCode}
                    />
                    <Pressable
                      disabled={verifyingCode || verificationCode.trim().length !== 6}
                      onPress={handleVerifyCode}
                      style={[
                        styles.saveButton,
                        { opacity: verifyingCode || verificationCode.trim().length !== 6 ? 0.55 : 1 },
                      ]}>
                      <ThemedText style={styles.saveButtonText}>
                        {verifyingCode ? t('verifyingLabel') : t('verifyCodeButton')}
                      </ThemedText>
                    </Pressable>
                  </View>
                  {verifyCodeError && <ThemedText style={styles.errorText}>{verifyCodeError}</ThemedText>}
                  <Pressable disabled={sendingCode} onPress={handleUseDifferentEmail}>
                    <ThemedText style={styles.avatarAction}>{t('useDifferentEmailLabel')}</ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('notificationsSection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <ThemedText style={styles.switchTitle}>{t('pushNotifTitle')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('pushNotifCopy')}
                  </ThemedText>
                </View>
                {pushLoading ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Switch
                    disabled={pushSubmitting}
                    onValueChange={handleTogglePush}
                    ios_backgroundColor="#B7BEC9"
                    thumbColor="#FFFFFF"
                    trackColor={{ false: '#B7BEC9', true: '#4F6FB7' }}
                    value={pushEnabled}
                  />
                )}
              </View>
              {pushError && <ThemedText style={styles.errorText}>{pushError}</ThemedText>}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('appearanceSection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.settingRow}>
                <ThemedText style={styles.switchTitle}>{t('languageLabel')}</ThemedText>
                <SegmentedControl
                  options={[
                    { id: 'sv', label: 'Svenska' },
                    { id: 'en', label: 'English' },
                  ]}
                  value={language}
                  onChange={(id) => setLanguage(id as Language)}
                />
              </View>

              <View style={styles.settingRow}>
                <ThemedText style={styles.switchTitle}>{t('themeLabel')}</ThemedText>
                <SegmentedControl
                  options={[
                    { id: 'light', label: t('themeLight') },
                    { id: 'dark', label: t('themeDark') },
                  ]}
                  value={themeMode}
                  onChange={(id) => setThemeMode(id as ThemeMode)}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.segmentButton, active && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText
              style={styles.segmentText}
              themeColor={active ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
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
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 30,
  },
  headerTitle: {
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
    gap: Spacing.three,
    padding: Spacing.three,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  avatarTouchable: {
    borderRadius: 32,
    height: 64,
    overflow: 'hidden',
    width: 64,
  },
  avatarImage: {
    height: 64,
    width: 64,
  },
  avatarFallback: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarFallbackText: {
    fontSize: 26,
    fontWeight: '800',
  },
  avatarOverlay: {
    alignItems: 'center',
    backgroundColor: '#1D243080',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  avatarCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  avatarTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  avatarAction: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  nameRow: {
    gap: Spacing.two,
  },
  nameInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
  },
  nameInput: {
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: Spacing.two,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  verifiedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  switchCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  segment: {
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: Spacing.two,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
