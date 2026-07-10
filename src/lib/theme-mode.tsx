import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'forkop-theme-mode';

const webStorage = {
  getItem: async (key: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: async (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

type ThemeModeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  // Default stays 'light' — the existing look is unchanged unless a user opts into dark mode.
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'dark' || value === 'light') setThemeModeState(value);
    });
  }, []);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      themeMode,
      setThemeMode: (mode) => {
        setThemeModeState(mode);
        storage.setItem(STORAGE_KEY, mode);
      },
    }),
    [themeMode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useThemeMode must be used inside ThemeModeProvider');
  }

  return context;
}
