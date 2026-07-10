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
