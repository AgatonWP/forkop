import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Image contentFit="contain" source={require('@/assets/images/logo-glow.png')} style={styles.glow} />
      <View style={styles.background} />
      <Image contentFit="contain" source={require('@/assets/images/expo-logo.png')} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    height: 128,
    justifyContent: 'center',
    width: 128,
    zIndex: 100,
  },
  glow: {
    height: 201,
    position: 'absolute',
    width: 201,
  },
  background: {
    backgroundColor: '#208AEF',
    borderRadius: 40,
    height: 128,
    position: 'absolute',
    width: 128,
  },
  image: {
    height: 71,
    position: 'absolute',
    width: 76,
  },
});
