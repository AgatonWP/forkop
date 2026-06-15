import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Listing } from '@/lib/types';
import { getNation } from '@/lib/nations';
import NationEmblem from '@/components/NationEmblem';
import { Tag, ArrowLeftRight, Users, Clock, CheckCircle, Trash2, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
// Conversation is created lazily on first message — see ChatDialog draft mode.
import ChatDialog from '@/components/ChatDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ListingDetailDialogProps {
  listing: (Listing & { originalPrice?: number }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMatch?: boolean;
  isOwner?: boolean;
  onMarkSold?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ListingDetailDialog({ listing, open, onOpenChange, isMatch, isOwner, onMarkSold, onDelete }: ListingDetailDialogProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draftListingId, setDraftListingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  if (!listing) return null;
  const nation = getNation(listing.nationId);
  const sv = lang === 'sv';

  const handleContactSeller = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // Open chat in DRAFT mode — no conversation row is created until the
    // buyer actually sends a message. This prevents empty chats from
    // appearing in the seller's inbox.
    setDraftListingId(listing.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <NationEmblem nationId={listing.nationId} size="md" />
              <div>
                <DialogTitle className="font-display text-lg">{listing.eventName}</DialogTitle>
                <p className="text-sm text-muted-foreground">{nation.name}</p>
              </div>
              {isMatch && (
                <span className="ml-auto rounded-md bg-foreground/5 border border-foreground/10 px-2 py-1 text-xs font-medium text-foreground animate-pulse-soft">
                  {t('matching.badge')}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex flex-wrap gap-2">
              {(listing.dealType === 'sell' || listing.dealType === 'both') && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sell/10 text-sell px-2.5 py-1 text-xs font-medium">
                  <Tag className="h-3 w-3" />
                  {t('listing.sell')}
                </span>
              )}
              {(listing.dealType === 'trade' || listing.dealType === 'both') && (
                <span className="inline-flex items-center gap-1 rounded-md bg-trade/10 text-trade px-2.5 py-1 text-xs font-medium">
                  <ArrowLeftRight className="h-3 w-3" />
                  {t('listing.trade')}
                </span>
              )}
            </div>

            <div className="text-sm">
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs mb-1">{t('listing.quantity')}</p>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {listing.quantity}
                </p>
              </div>
            </div>

            {listing.tradeDescription && (
              <div className="rounded-md bg-trade/5 border border-trade/10 p-3">
                <p className="text-xs text-muted-foreground mb-1">{t('listing.tradeFor')}</p>
                <p className="text-sm font-medium text-foreground">{listing.tradeDescription}</p>
              </div>
            )}

            {listing.description && listing.description.trim() && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">{sv ? 'Beskrivning' : 'Description'}</p>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{listing.description}</p>
              </div>
            )}

            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">{sv ? 'Upplagd av' : 'Posted by'}</p>
              <p className="text-sm font-medium text-foreground">{listing.sellerName || (sv ? 'Användare' : 'User')}</p>
            </div>

            {!isOwner && !listing.isSold && (
              <Button
                onClick={handleContactSeller}
                className="w-full gap-2 font-display font-semibold"
                size="lg"
              >
                <MessageCircle className="h-4 w-4" />
                {sv ? 'Kontakta säljare' : 'Contact seller'}
              </Button>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {timeAgo(listing.createdAt)}
              </span>
              <div className="flex items-center gap-1.5">
                {isOwner && onMarkSold && !listing.isSold && (
                  <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => onMarkSold(listing.id)}>
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('listing.markSold')}
                  </Button>
                )}
                {isOwner && onDelete && (
                  <Button variant="outline" size="sm" className="gap-1 h-8 text-xs text-destructive hover:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChatDialog
        conversationId={null}
        draftListingId={draftListingId}
        open={!!draftListingId}
        onOpenChange={(o) => { if (!o) setDraftListingId(null); }}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={sv ? 'Ta bort annonsen?' : 'Delete listing?'}
        description={sv ? 'Det här går inte att ångra.' : 'This action cannot be undone.'}
        confirmLabel={sv ? 'Ta bort' : 'Delete'}
        cancelLabel={sv ? 'Avbryt' : 'Cancel'}
        destructive
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete?.(listing.id);
          onOpenChange(false);
        }}
      />
    </>
  );
}
