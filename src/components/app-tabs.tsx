import Ionicons from '@expo/vector-icons/Ionicons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <Label>Köp</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="sell">
        <Label>Lägg upp</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="add-circle-outline" />,
            selected: <VectorIcon family={Ionicons} name="add-circle" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <Label>Meddelanden</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="chatbubble-outline" />,
            selected: <VectorIcon family={Ionicons} name="chatbubble" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <Label>Profil</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="person-circle-outline" />,
            selected: <VectorIcon family={Ionicons} name="person-circle" />,
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
