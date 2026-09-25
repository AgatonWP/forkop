import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { ChatMenuAction, ChatScreen } from '@/components/chat-screen';
import { RatingModal } from '@/components/rating-modal';
import { ThemedText } from '@/components/themed-text';
import { OfficialAccountBadge, VerifiedOrganizerBadge } from '@/components/verified-organizer-badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Conversation, fetchConversation, getOrCreateConversation } from '@/lib/messages';
import { fetchSellerSwishNumber } from '@/lib/payment-details';
import { RatingSummary, fetchRatingSummary } from '@/lib/ratings';
import {
  Listing,
  conversationRoles,
  formatListingEventDate,
  formatTicketQuantity,
  markListingSold,
} from '@/lib/tickets';
import { useVerifiedOrganizers } from '@/lib/verified-organizers';

type Props = {
  listing: Listing | null;
  /** When opened from an inbox (e.g. as the seller), pass the known conversation id to skip creation. */
  conversationId?: string;
  onClose: () => void;
  /** Notifies the caller (e.g. the inbox list) when the seller marks the listing sold from here. */
  onListingSold?: (listing: Listing) => void;
  /** After the user removed this conversation from their inbox. */
  onHidden?: (conversationId: string) => void;
};

/**
 * The chat about a ticket listing: ChatScreen plus what only tickets have —
 * Swish for the buyer, the seller's rating, the verified-organizer badge and
 * marking the listing sold.
 */
export function ChatModal({ listing, conversationId, onClose, onListingSold, onHidden }: Props) {
  const theme = useTheme();
  const { user } = useAuth();
  const { language, t } = useI18n();
  const { isVerifiedOrganizerListing, officialAccountNameFor } = useVerifiedOrganizers();
  const listingDirection = listing?.direction ?? 'offer';
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [sellerSwishNumber, setSellerSwishNumber] = useState<string | null>(null);
  const [swishNumberCopied, setSwishNumberCopied] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [ratingListing, setRatingListing] = useState<Listing | null>(null);

  const loadConversation = useCallback(() => {
    if (!listing || !user) return Promise.reject(new Error('No listing'));
    return conversationId
      ? fetchConversation(conversationId)
      : getOrCreateConversation(
          listing.id,
          user.id,
          user.user_metadata?.full_name ?? user.email?.split('@')[0],
          user.user_metadata?.avatar_url,
        );
  }, [conversationId, listing, user]);

  useEffect(() => {
    if (!listing) {
      setRatingSummary(null);
      return;
    }

    let active = true;
    fetchRatingSummary(listing.userId)
      .then((summary) => {
        if (active) setRatingSummary(summary.count > 0 ? summary : null);
      })
      .catch(() => {
        if (active) setRatingSummary(null);
      });

    return () => {
      active = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!conversation || !user) {
      setSellerSwishNumber(null);
      return;
    }

    let active = true;
    // Swish belongs to the buyer and shows the seller's number. On an offer
    // that is the person who got in touch; on a wanted post, the owner.
    const roles = conversationRoles({ direction: listingDirection }, conversation);

    (roles.buyerId === user.id ? fetchSellerSwishNumber(roles.sellerId) : Promise.resolve(null))
      .then((swishNumber) => {
        if (active) setSellerSwishNumber(swishNumber);
      })
      .catch(() => {
        if (active) setSellerSwishNumber(null);
      });

    return () => {
      active = false;
    };
  }, [conversation, listingDirection, user]);

  const handleCopySwishNumber = useCallback(async () => {
    if (!sellerSwishNumber) return;

    await Clipboard.setStringAsync(sellerSwishNumber);
    setSwishNumberCopied(true);
    setTimeout(() => setSwishNumberCopied(false), 1500);
  }, [sellerSwishNumber]);

  const handleOpenSwish = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL('swish://');
      if (!supported) {
        Alert.alert(t('swishSectionTitle'), t('swishNotInstalled'));
        return;
      }
      await Linking.openURL('swish://');
    } catch {
      Alert.alert(t('swishSectionTitle'), t('swishOpenError'));
    }
  }, [t]);

  const handleMarkSold = useCallback(async () => {
    if (!listing || !user || listing.userId !== user.id || listing.isSold || markingSold) return;

    setMarkingSold(true);

    try {
      const soldListingId = await markListingSold(listing);
      const soldListing = { ...listing, id: soldListingId, isSold: true, updatedAt: new Date() };
      onListingSold?.(soldListing);
      setRatingListing(soldListing);
    } catch {
      Alert.alert(t('markSoldError'));
    } finally {
      setMarkingSold(false);
    }
  }, [listing, markingSold, onListingSold, t, user]);

  const menuActions = useMemo<ChatMenuAction[]>(
    () =>
      listing && user && listing.userId === user.id && !listing.isSold
        ? [{ text: listing.direction === 'wanted' ? t('markAsBought') : t('markAsSold'), onPress: handleMarkSold }]
        : [],
    [handleMarkSold, listing, t, user],
  );

  const isOwner = !!user && !!listing && listing.userId === user.id;
  // The other party's badge: their own name when the account is official.
  const officialName = listing ? officialAccountNameFor(isOwner ? conversation?.buyerId ?? '' : listing.userId) : undefined;
  // Mirrors conversationRoles() without needing the conversation to have loaded.
  const iAmBuyer = listing?.direction === 'wanted' ? isOwner : !isOwner;
  const otherPartyName = isOwner ? (conversation?.buyerName ?? t('buyer')) : (listing?.sellerName ?? t('seller'));
  const otherPartyAvatarUrl = isOwner ? conversation?.buyerAvatarUrl : listing?.sellerAvatarUrl;
  const subtitle = listing
    ? [
        listing.eventName,
        listing.eventDate ? formatListingEventDate(listing.eventDate, language) : null,
        `${formatTicketQuantity(listing.quantity)} st`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <ChatScreen
      chatKey={listing ? (conversationId ?? listing.id) : null}
      loadConversation={loadConversation}
      onClose={onClose}
      onConversation={setConversation}
      onHidden={onHidden}
      header={{
        name: otherPartyName,
        avatarUrl: otherPartyAvatarUrl,
        nameAccessory: !listing || isOwner ? null : officialName ? (
          <OfficialAccountBadge name={officialName} />
        ) : isVerifiedOrganizerListing(listing) ? (
          <VerifiedOrganizerBadge />
        ) : null,
        subtitle,
        subtitleAccessory:
          !isOwner && ratingSummary ? (
            <View style={styles.sellerRatingBadge}>
              <ThemedText
                style={[
                  styles.sellerRatingEmoji,
                  { transform: [{ rotate: `${-(5 - Math.round(ratingSummary.average)) * 45}deg` }] },
                ]}>
                👍
              </ThemedText>
              <ThemedText style={styles.sellerRatingCount}>({ratingSummary.count})</ThemedText>
            </View>
          ) : null,
      }}
      banner={
        iAmBuyer && sellerSwishNumber ? (
          <View style={[styles.swishBar, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.backgroundSelected }]}>
            <Pressable
              onPress={handleCopySwishNumber}
              style={({ pressed }) => [
                styles.swishActionButton,
                { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
              ]}>
              <ThemedText style={styles.swishActionButtonText}>
                {swishNumberCopied ? t('copiedLabel') : t('copyNumber')}
              </ThemedText>
            </Pressable>
            <View style={[styles.swishActionDivider, { backgroundColor: theme.backgroundSelected }]} />
            <Pressable
              onPress={handleOpenSwish}
              style={({ pressed }) => [
                styles.swishActionButton,
                { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
              ]}>
              <ThemedText style={styles.swishActionButtonText}>{t('openSwishApp')}</ThemedText>
            </Pressable>
          </View>
        ) : null
      }
      menuActions={menuActions}
      menuBusy={markingSold}
      report={{ listing }}>
      <RatingModal listing={ratingListing} onClose={() => setRatingListing(null)} />
    </ChatScreen>
  );
}

const styles = StyleSheet.create({
  sellerRatingBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  sellerRatingEmoji: {
    fontSize: 12,
  },
  sellerRatingCount: {
    color: '#9AA3B2',
    fontSize: 11,
    fontWeight: '700',
  },

  swishBar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  swishActionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  swishActionButtonText: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  swishActionDivider: {
    height: 20,
    width: StyleSheet.hairlineWidth,
  },
});
