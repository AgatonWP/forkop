import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Landing screen for the password-reset link Supabase emails. The link
 * carries a PKCE `code` query param that must be exchanged for a session
 * before the user is allowed to set a new password.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [status, setStatus] = useState<'exchanging' | 'ready' | 'invalid'>('exchanging');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus('invalid');
      return;
    }

    let active = true;

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (active) setStatus(error ? 'invalid' : 'ready');
    });

    return () => {
      active = false;
    };
  }, [code]);

  async function handleSubmit() {
    if (submitting || newPassword.length < 6) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setDone(true);
      setTimeout(() => router.replace('/'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('passwordSaveError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'exchanging') {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} size="small" />
      </ThemedView>
    );
  }

  if (status === 'invalid') {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.errorText}>{t('resetLinkInvalidError')}</ThemedText>
        <Pressable onPress={() => router.replace('/')}>
          <ThemedText style={styles.link}>{t('backToSignIn')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.container}>
        <ThemedText type="subtitle">{t('resetPasswordTitle')}</ThemedText>

        {done ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('resetPasswordSuccess')}
          </ThemedText>
        ) : (
          <>
            <TextInput
              autoCapitalize="none"
              autoFocus
              onChangeText={setNewPassword}
              placeholder={t('newPasswordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
              ]}
              value={newPassword}
            />

            {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

            <Pressable
              disabled={submitting || newPassword.length < 6}
              onPress={handleSubmit}
              style={[styles.button, { opacity: submitting || newPassword.length < 6 ? 0.55 : 1 }]}>
              <ThemedText style={styles.buttonText}>
                {submitting ? t('wait') : t('updatePasswordButton')}
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  container: {
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
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
  link: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: Spacing.three,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
