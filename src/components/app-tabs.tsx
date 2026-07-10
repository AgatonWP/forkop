import Ionicons from '@expo/vector-icons/Ionicons';
import { Badge, Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useThemeMode } from '@/lib/theme-mode';
import { useUnreadMessages } from '@/lib/unread-messages';

export default function AppTabs() {
  const { themeMode } = useThemeMode();
  const colors = Colors[themeMode];
  const { t } = useI18n();
  const { hasUnread } = useUnreadMessages();

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
        <Badge hidden={!hasUnread}>{''}</Badge>
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
    </NativeTabs>
  );
}
