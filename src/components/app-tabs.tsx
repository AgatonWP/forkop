import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useThemeMode } from '@/lib/theme-mode';
import { useUnreadMessages } from '@/lib/unread-messages';

export default function AppTabs() {
  const { themeMode } = useThemeMode();
  const colors = Colors[themeMode];
  const { t } = useI18n();
  const { unreadConversationCount } = useUnreadMessages();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopColor: colors.backgroundSelected,
        },
        tabBarLabelStyle: {
          // Five tabs leave about 75 px each on a 375 px screen, and
          // "Meddelanden" did not fit at 12.
          fontSize: 10,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('buy'),
          tabBarIcon: ({ focused, size }) => (
            <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>🕺</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="lost"
        options={{
          title: t('lostTab'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'search' : 'search-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: t('sell'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'add-circle' : 'add-circle-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages'),
          tabBarBadge:
            unreadConversationCount > 0
              ? unreadConversationCount > 9
                ? '9+'
                : unreadConversationCount
              : undefined,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              color={color}
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
