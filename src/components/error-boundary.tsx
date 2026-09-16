import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

type Props = {
  error: Error;
  retry: () => Promise<void>;
};

/**
 * Expo Router renders this instead of a red screen (dev) or a blank white one
 * (production) when a screen throws. It deliberately uses no context of its
 * own — a crash inside a provider would otherwise take the error screen down
 * with it — so the strings are Swedish and the colors come straight from the
 * OS theme.
 */
export function AppErrorBoundary({ error, retry }: Props) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  return (
    <View style={[styles.screen, { backgroundColor: dark ? '#14181F' : '#F5F6F8' }]}>
      <View style={[styles.card, { backgroundColor: dark ? '#1D2430' : '#FFFFFF' }]}>
        <Text style={[styles.title, { color: dark ? '#F5F6F8' : '#1D2430' }]}>Något gick fel</Text>
        <Text style={[styles.copy, { color: dark ? '#A7B0BD' : '#687283' }]}>
          Appen stötte på ett oväntat fel. Försök igen – hjälper det inte, starta om appen.
        </Text>
        <Pressable
          onPress={() => retry()}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.buttonText}>Försök igen</Text>
        </Pressable>
        {__DEV__ && (
          <Text style={[styles.details, { color: dark ? '#687283' : '#98A1AF' }]}>{error.message}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    gap: 12,
    maxWidth: 420,
    padding: 24,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  copy: {
    fontSize: 15,
    lineHeight: 21,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  details: {
    fontSize: 12,
    marginTop: 4,
  },
});
