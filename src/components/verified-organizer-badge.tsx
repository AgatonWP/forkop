import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  organizerName?: string;
  style?: StyleProp<ViewStyle>;
};

export function VerifiedOrganizerBadge({ organizerName, style }: Props) {
  const { t } = useI18n();
  const label = organizerName ? `${t('verifiedOrganizerBadge')} · ${organizerName}` : t('verifiedOrganizerBadge');

  return (
    <View accessibilityLabel={label} style={[styles.badge, style]}>
      <ThemedText numberOfLines={1} style={styles.text}>
        ✓ {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2F74E0',
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
