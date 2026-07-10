import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { Logo } from './logo';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useUnreadMessages } from '@/lib/unread-messages';

export default function AppTabs() {
  const { t } = useI18n();
  const { hasUnread } = useUnreadMessages();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{t('buy')}</TabButton>
          </TabTrigger>
          <TabTrigger name="sell" href="/sell" asChild>
            <SellTabButton>+ {t('sell')}</SellTabButton>
          </TabTrigger>
          <TabTrigger name="messages" href="/messages" asChild>
            <TabButton showDot={hasUnread}>{t('messages')}</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>{t('profile')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  showDot,
  ...props
}: TabTriggerSlotProps & { showDot?: boolean }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
        {showDot && <View style={styles.unreadDot} />}
      </ThemedView>
    </Pressable>
  );
}

export function SellTabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={[styles.sellButtonView, isFocused && styles.sellButtonViewActive]}>
        <ThemedText style={[styles.sellButtonText, isFocused && styles.sellButtonTextActive]}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <View style={styles.brandText}>
          <Logo />
        </View>

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  unreadDot: {
    backgroundColor: '#C84646',
    borderRadius: 999,
    height: 7,
    position: 'absolute',
    right: 4,
    top: 4,
    width: 7,
  },
  sellButtonView: {
    backgroundColor: '#1D2430',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
  },
  sellButtonViewActive: {
    backgroundColor: '#E39E72',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sellButtonTextActive: {
    color: '#FFFFFF',
  },
});
