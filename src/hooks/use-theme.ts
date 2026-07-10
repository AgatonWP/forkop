/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/lib/theme-mode';

export function useTheme() {
  const { themeMode } = useThemeMode();
  return Colors[themeMode];
}
