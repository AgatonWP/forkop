import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { ChatMenuAction, ChatScreen } from '@/components/chat-screen';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  LOST_ITEM_CATEGORY_EMOJI,
  LostItem,
  lostItemPlaceName,
  lostItemTitle,
  resolveLostItem,
} from '@/lib/lost-items';
import { Conversation, fetchConversation, getOrCreateLostItemConversation } from '@/lib/messages';
import { formatListingEventDate } from '@/lib/tickets';

type Props = {
  item: LostItem | null;
  /** Passed when opening from the inbox, where the conversation already exists. */
  conversationId?: string;
  onClose: () => void;
  /** After the owner marked the item returned from here. */
  onResolved?: (item: LostItem) => void;
  /** After the user removed this conversation from their inbox. */
  onHidden?: (conversationId: string) => void;
};

/**
 * The chat about a lost item: the same ChatScreen as for tickets, with the
 * item in the header instead of the listing and "Återlämnad" in place of
 * "Markera som såld". No Swish or ratings — nothing is being sold.
 */
export function LostItemChatModal({ item, conversationId, onClose, onResolved, onHidden }: Props) {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const loadConversation = useCallback(() => {
    if (!item || !user) return Promise.reject(new Error('No item'));
    return conversationId
      ? fetchConversation(conversationId)
      : getOrCreateLostItemConversation(
          item.id,
          user.id,
          user.user_metadata?.full_name ?? user.email?.split('@')[0],
          user.user_metadata?.avatar_url,
        );
  }, [conversationId, item, user]);

  const isOwnPost = !!user && !!item && item.userId === user.id;

  const handleResolve = useCallback(async () => {
    if (!item || !user || !isOwnPost) return;

    try {
      await resolveLostItem(item.id, user.id);
      onResolved?.({ ...item, status: 'resolved' });
    } catch {
      Alert.alert(t('lostResolveError'));
    }
  }, [isOwnPost, item, onResolved, t, user]);

  const menuActions = useMemo<ChatMenuAction[]>(
    () => (isOwnPost && item?.status === 'open' ? [{ text: t('lostMarkResolved'), onPress: handleResolve }] : []),
    [handleResolve, isOwnPost, item?.status, t],
  );

  const otherPartyName = isOwnPost
    ? (conversation?.buyerName ?? t('chatUnknownName'))
    : (item?.reporterName ?? t('chatUnknownName'));
  const otherPartyAvatarUrl = isOwnPost ? conversation?.buyerAvatarUrl : item?.reporterAvatarUrl;
  const subtitle = item
    ? [
        `${LOST_ITEM_CATEGORY_EMOJI[item.category]} ${lostItemTitle(item, t)}`,
        t(item.kind === 'found' ? 'lostSegmentFound' : 'lostSegmentLost'),
        lostItemPlaceName(item),
        formatListingEventDate(item.happenedOn, language),
      ].join(' · ')
    : '';

  return (
    <ChatScreen
      chatKey={item ? (conversationId ?? item.id) : null}
      loadConversation={loadConversation}
      onClose={onClose}
      onConversation={setConversation}
      onHidden={onHidden}
      header={{ name: otherPartyName, avatarUrl: otherPartyAvatarUrl, subtitle }}
      menuActions={menuActions}
      report={{ lostItem: item }}
    />
  );
}
