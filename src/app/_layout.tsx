import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode';
import { UnreadMessagesProvider } from '@/lib/unread-messages';
import '@/lib/notification-handler';

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <I18nProvider>
          <UnreadMessagesProvider>
            <RootNavigator />
          </UnreadMessagesProvider>
        </I18nProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

function RootNavigator() {
  const { themeMode } = useThemeMode();

  return (
    <ThemeProvider value={themeMode === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
      </Stack>
    </ThemeProvider>
  );
}
