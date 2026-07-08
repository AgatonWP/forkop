import Ionicons from '@expo/vector-icons/Ionicons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useI18n();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <Label>{t('buy')}</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="sell">
        <Label>{t('sell')}</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="add-circle-outline" />,
            selected: <VectorIcon family={Ionicons} name="add-circle" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <Label>{t('messages')}</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="chatbubble-outline" />,
            selected: <VectorIcon family={Ionicons} name="chatbubble" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <Label>{t('profile')}</Label>
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="person-circle-outline" />,
            selected: <VectorIcon family={Ionicons} name="person-circle" />,
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings" hidden />
    </NativeTabs>
  );
}
