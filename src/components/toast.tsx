import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Shows the toast while non-null; the parent clears it via onHidden. */
  message: string | null;
  onHidden: () => void;
  topOffset: number;
};

export function Toast({ message, onHidden, topOffset }: Props) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  // Kept in a ref so an inline parent callback doesn't restart the animation.
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onHiddenRef.current();
    });

    return () => animation.stop();
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          top: topOffset,
          opacity,
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
        },
      ]}>
      <ThemedText style={styles.text}>{message}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 4,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    position: 'absolute',
    shadowColor: '#1D2430',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '800',
  },
});
