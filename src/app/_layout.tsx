import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppErrorBoundary } from '@/components/error-boundary';
import { useAppUpdateCheck } from '@/hooks/use-app-update-check';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode';
import { TicketWatchesProvider } from '@/lib/ticket-watches';
import { UnreadMessagesProvider } from '@/lib/unread-messages';
import { VerifiedOrganizersProvider } from '@/lib/verified-organizers';
import '@/lib/notification-handler';

// Expo Router picks this up by name: any screen that throws lands here
// instead of on a blank screen.
export { AppErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <I18nProvider>
          <UnreadMessagesProvider>
            <VerifiedOrganizersProvider>
              <TicketWatchesProvider>
                <RootNavigator />
              </TicketWatchesProvider>
            </VerifiedOrganizersProvider>
          </UnreadMessagesProvider>
        </I18nProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

function RootNavigator() {
  const { themeMode } = useThemeMode();
  useAppUpdateCheck();

  return (
    <ThemeProvider value={themeMode === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="watches" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="support" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="auth-redirect" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </ThemeProvider>
  );
}
