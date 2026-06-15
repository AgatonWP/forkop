import { Image, StyleSheet, Text, View } from 'react-native';

import { getNation } from '@/lib/nations';

const NATION_IMAGES: Record<string, ReturnType<typeof require>> = {
  goteborgs: require('@/assets/images/nations/goteborgs.png'),
  helsingkrona: require('@/assets/images/nations/helsingkrona.png'),
  malmo: require('@/assets/images/nations/malmo.png'),
  lunds: require('@/assets/images/nations/lunds.png'),
  afborgen: require('@/assets/images/nations/afborgen.png'),
  vg: require('@/assets/images/nations/vastgota.png'),
  ostgota: require('@/assets/images/nations/ostgota.png'),
  blekingska: require('@/assets/images/nations/blekingska.png'),
  kristianstad: require('@/assets/images/nations/kristianstad.png'),
  hallands: require('@/assets/images/nations/hallands.png'),
  kalmar: require('@/assets/images/nations/kalmar.png'),
  wermlands: require('@/assets/images/nations/wermlands.png'),
  sydskanska: require('@/assets/images/nations/sydskanska.png'),
};

interface NationEmblemProps {
  nationId: string;
  size?: 'sm' | 'md';
}

export function NationEmblem({ nationId, size = 'sm' }: NationEmblemProps) {
  const nation = getNation(nationId);
  const dim = size === 'sm' ? 36 : 48;
  const image = NATION_IMAGES[nationId];

  if (image) {
    return (
      <View style={[styles.container, { width: dim, height: dim, borderRadius: dim / 2 }]}>
        <Image source={image} style={styles.image} resizeMode="contain" />
      </View>
    );
  }

  const bgColor = nation.color + '26';
  return (
    <View style={[styles.fallback, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bgColor }]}>
      <Text style={[styles.fallbackText, { color: nation.color }]}>{nation.shortName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '80%',
    height: '80%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
