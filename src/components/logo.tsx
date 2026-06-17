import { StyleSheet, Text, View } from 'react-native';

export function Logo() {
  return (
    <View style={styles.container}>
      <Text style={styles.main}>FÖRKÖP</Text>
      <View style={styles.divider} />
      <Text style={styles.sub}>LUND</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  main: {
    color: '#1D2430',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#E39E72',
    opacity: 0.6,
  },
  sub: {
    color: '#E39E72',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
