import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

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

/**
 * An official account carries its own name rather than an organizer's: LTH
 * Griparna sell their spare förköp to other people's events, so "verifierad
 * arrangör" would say the wrong thing. Their picture rides along, which is how
 * the tick is recognised at a glance in the feed.
 */
export function OfficialAccountBadge({
  name,
  pictureUrl,
  compact = false,
  style,
}: {
  name: string;
  pictureUrl?: string;
  /** Just the tick, for where the name is already on screen — a chat header. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (compact) {
    return (
      <View accessibilityLabel={`${name} · officiellt konto`} style={[styles.badge, styles.compactBadge, style]}>
        <ThemedText style={styles.text}>✓</ThemedText>
      </View>
    );
  }

  return (
    <View accessibilityLabel={`${name} · officiellt konto`} style={[styles.badge, styles.officialBadge, style]}>
      {pictureUrl && <Image contentFit="cover" source={{ uri: pictureUrl }} style={styles.picture} />}
      <ThemedText numberOfLines={1} style={styles.text}>
        ✓ {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.one,
    backgroundColor: '#2F74E0',
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  officialBadge: {
    paddingLeft: 5,
  },
  compactBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  picture: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  text: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
});
