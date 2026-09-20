import { Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const FONT_SIZE = 20;
// Kept as ratios so the dots hold their proportions at any logo size.
const DOT_SIZE = FONT_SIZE * 0.125;
const DOT_GAP = FONT_SIZE * 0.13;
// Sitting on the bottom of the text box puts the dots in the descender
// space, which is the whole gap there is between them and the baseline.
const DOT_DROP = 0;

export function Logo() {
  const theme = useTheme();
  // Poppins is the geometric sans the wordmark is drawn in. Until it is ready
  // the system font stands in; at this size the swap is barely visible.
  const [fontsLoaded] = useFonts({ Poppins_700Bold });
  const font = fontsLoaded ? styles.brandFont : styles.brandFallback;

  return (
    <View style={styles.container}>
      <View style={styles.word}>
        <Text style={[styles.main, font, { color: theme.text }]}>FÖRK</Text>
        {/* The second Ö wears its dots underneath. Drawn rather than typed:
            no font places a diaeresis below a capital O, and this way the
            spacing stays right whatever font the logo ends up using. */}
        <View style={styles.underdotO}>
          <Text style={[styles.main, font, { color: theme.text }]}>O</Text>
          <View style={styles.dots} pointerEvents="none">
            <View style={[styles.dot, { backgroundColor: theme.text }]} />
            <View style={[styles.dot, { backgroundColor: theme.text }]} />
          </View>
        </View>
        <Text style={[styles.main, font, { color: theme.text }]}>P</Text>
      </View>
      <View style={styles.divider} />
      <Text style={[styles.sub, font]}>LUND</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  word: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  main: {
    fontSize: FONT_SIZE,
    letterSpacing: -0.5,
  },
  brandFont: {
    fontFamily: 'Poppins_700Bold',
  },
  brandFallback: {
    fontWeight: '900',
  },
  underdotO: {
    alignItems: 'center',
  },
  dots: {
    bottom: DOT_DROP,
    flexDirection: 'row',
    gap: DOT_GAP,
    position: 'absolute',
  },
  dot: {
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#E39E72',
    opacity: 0.6,
  },
  sub: {
    color: '#E39E72',
    fontSize: FONT_SIZE,
    letterSpacing: 1.5,
  },
});
