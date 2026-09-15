import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/**
 * Landing screen for links Supabase sends by email (signup confirmation,
 * password reset). Expo Router doesn't reliably match a deep link that
 * points at the bare app root, so auth emails are pointed here instead —
 * a real, explicitly registered route — which then forwards into the app.
 *
 * Signup confirmation links carry a PKCE `code`, which can be exchanged for
 * a session to sign the user in immediately instead of making them log in
 * by hand right after confirming.
 */
export default function AuthRedirectScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      // Signed in: confirm it with a toast on the home screen. Otherwise send
      // them to the sign-in form, which explains that the account is ready.
      router.replace(error ? '/(tabs)/explore?confirmed=1' : '/?confirmed=1');
    });
  }, [code]);

  const theme = useTheme();

  return (
    <ThemedView style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
      <ActivityIndicator color={theme.textSecondary} size="small" />
    </ThemedView>
  );
}
