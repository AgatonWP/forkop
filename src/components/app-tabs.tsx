import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useThemeMode } from '@/lib/theme-mode';
import { useUnreadMessages } from '@/lib/unread-messages';

/**
 * iOS 26 draws its own bars in glass. This bar is ours — four tabs with an
 * emoji, a label that hides itself and an icon that grows — so it gets the
 * glass behind it instead: the same material, under a bar we still decide the
 * behaviour of. Older iOS, Android and web keep the solid bar, since the
 * component falls back to a plain transparent view where the effect does not
 * exist, which would leave the tabs floating over the feed.
 */
const GLASS = isLiquidGlassAvailable();

/**
 * The tab you are on shows its icon a size up and lowered into the middle of
 * the bar, filling the space its hidden label leaves. React Navigation draws
 * every icon twice, a focused and an unfocused copy, and swaps between them,
 * so `focused` says which copy this is and the change lands with the swap.
 */
function TabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  return <View style={focused && styles.iconFocused}>{children}</View>;
}

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
        tabBarStyle: GLASS
          ? {
              // The glass has to sit over the content to have anything to
              // refract; every screen already leaves BottomTabInset free at
              // the bottom, so nothing ends up underneath it for good.
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              position: 'absolute',
            }
          : {
              backgroundColor: colors.backgroundElement,
              borderTopColor: colors.backgroundSelected,
            },
        tabBarBackground: GLASS
          ? () => <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
          : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('buy'),
          tabBarLabel: label(t('buy')),
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused}>
              <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>🕺</Text>
            </TabIcon>
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
            <TabIcon focused={focused}>
              <Ionicons color={color} name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="lost"
        options={{
          title: t('lostTab'),
          tabBarLabel: label(t('lostTab')),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon focused={focused}>
              <Ionicons color={color} name={focused ? 'search' : 'search-outline'} size={size} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('profile'),
          tabBarLabel: label(t('profile')),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon focused={focused}>
              <Ionicons
                color={color}
                name={focused ? 'person-circle' : 'person-circle-outline'}
                size={size}
              />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconFocused: {
    // The bar is 49 pt tall and the icon's 28 pt box starts 5 pt down it, so
    // the icon is centred at 19 pt against the bar's 24.5.
    transform: [{ translateY: 5.5 }, { scale: 1.2 }],
  },
  label: {
    // Four tabs leave room for the full words again.
    fontSize: 12,
    fontWeight: '700',
  },
});
