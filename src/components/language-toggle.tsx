import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/lib/i18n';

export function LanguageToggle() {
  const { language, toggleLanguage } = useI18n();

  return (
    <Pressable
      accessibilityLabel="Byt språk"
      onPress={toggleLanguage}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ThemedText style={styles.text}>{language === 'sv' ? 'EN' : 'SV'}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderColor: '#E6E9EE',
    borderRadius: 6,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 36,
  },
  pressed: {
    opacity: 0.72,
  },
  text: {
    color: '#1D2430',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
});
