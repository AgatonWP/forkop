import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * The round dark + in a screen header. Shared rather than restyled per screen:
 * the two copies had drifted to 36 px with a 22 pt glyph on one screen and
 * 32 px with a 20 pt one on the other, which read as a mistake when you moved
 * between the tabs. Drawn as an icon rather than a "+" character so the plus
 * sits dead centre whatever the system font does.
 */
export function AddButton({ accessibilityLabel, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons color="#FFFFFF" name="add" size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    shadowColor: '#1D2430',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: 36,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
