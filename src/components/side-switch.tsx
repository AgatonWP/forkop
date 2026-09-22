import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props<T extends string> = {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The buy/sell switch: Köp | Sälj on Hitta, Jag säljer | Jag söker when
 * posting. One component so the two stay the same control. Dark enough to read
 * as the screen's main choice; fixed colours rather than theme ones, as it is
 * its own dark surface in both light and dark mode. The options share the
 * width it is given, so size it from outside.
 */
export function SideSwitch<T extends string>({ options, value, onChange, style }: Props<T>) {
  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.id === value;

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            style={[styles.item, active && styles.itemActive]}>
            <ThemedText numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#3A4452',
    borderRadius: 999,
    flexDirection: 'row',
    padding: 3,
  },
  item: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  itemActive: {
    backgroundColor: '#FFFFFF',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  labelActive: {
    color: '#1D2430',
  },
});
