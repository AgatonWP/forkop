import { DefaultTheme, ThemeProvider } from '@react-navigation/native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider } from '@/lib/auth';
import '@/lib/notification-handler';

export default function TabLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
      </AuthProvider>
    </ThemeProvider>
  );
}
