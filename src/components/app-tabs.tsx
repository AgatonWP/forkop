import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useThemeMode } from '@/lib/theme-mode';
import { useUnreadMessages } from '@/lib/unread-messages';

/**
 * Four destinations, ordered by how often they are opened, with the profile
 * pinned right where every app puts "me". Posting a listing is an action, not a
 * destination, so it lives as a modal behind the + on the first tab.
 */
export default function AppTabs() {
  const { themeMode } = useThemeMode();
  const colors = Colors[themeMode];
  const { t } = useI18n();
  const { unreadConversationCount } = useUnreadMessages();

  /**
   * The tab you are on drops its label and keeps only the icon. Hidden with
   * opacity rather than by rendering nothing, so the icons stay on the same
   * line instead of jumping a few pixels as you switch tabs.
   */
  const label = (text: string) =>
    function TabLabel({ focused, color }: { focused: boolean; color: string }) {
      return <Text style={[styles.label, { color, opacity: focused ? 0 : 1 }]}>{text}</Text>;
    };

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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('buy'),
          tabBarLabel: label(t('buy')),
          tabBarIcon: ({ focused, size }) => (
            <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>🕺</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages'),
          tabBarLabel: label(t('messages')),
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
        name="lost"
        options={{
          title: t('lostTab'),
          tabBarLabel: label(t('lostTab')),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'search' : 'search-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('profile'),
          tabBarLabel: label(t('profile')),
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

const styles = StyleSheet.create({
  label: {
    // Four tabs leave room for the full words again.
    fontSize: 12,
    fontWeight: '700',
  },
});
