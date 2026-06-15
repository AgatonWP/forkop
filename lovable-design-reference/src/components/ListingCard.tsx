import { motion } from 'framer-motion';
import { Tag, ArrowLeftRight, MessageCircle } from 'lucide-react';
import { Listing } from '@/lib/types';
import NationEmblem from '@/components/NationEmblem';
import { getNation } from '@/lib/nations';
import { useI18n } from '@/lib/i18n';

interface ListingCardProps {
  listing: Listing;
  index: number;
  onClick: () => void;
  hasActiveChat?: boolean;
}

export default function ListingCard({ listing, index, onClick, hasActiveChat = false }: ListingCardProps) {
  const { t, lang } = useI18n();
  const nation = getNation(listing.nationId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-[#e39e72]/28 hover:shadow-sm active:scale-[0.995]"
    >
      {hasActiveChat && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#e39e72]/25 bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm">
          <MessageCircle className="h-3 w-3 text-[#e39e72]" />
          {lang === 'sv' ? 'Aktiv chatt' : 'Active chat'}
        </div>
      )}
      {listing.isSold && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-foreground/50">
          <span className="font-display text-xl font-bold text-card tracking-wider rotate-[-12deg]">{t('listings.sold')}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <NationEmblem nationId={listing.nationId} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-display text-base font-bold text-foreground truncate uppercase tracking-wide min-w-0">
              {(() => {
                const idx = listing.eventName.indexOf(' – ');
                if (idx === -1) return listing.eventName;
                return (
                  <>
                    {listing.eventName.slice(0, idx)}
                    <span className="text-[11px] font-medium text-muted-foreground tracking-normal normal-case ml-1">
                      {listing.eventName.slice(idx + 3)}
                    </span>
                  </>
                );
              })()}
            </h3>
            <span className="shrink-0 rounded-full border border-[#e39e72]/18 bg-[#ffc8a5]/30 px-2 py-0.5 text-[11px] font-medium text-foreground">
              {listing.quantity} st
            </span>
            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">{nation.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(listing.dealType === 'sell' || listing.dealType === 'both') && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sell/10 text-sell px-2 py-0.5 text-[11px] font-medium">
                <Tag className="h-3 w-3" />
                {t('listing.sell')}
              </span>
            )}
            {(listing.dealType === 'trade' || listing.dealType === 'both') && listing.tradeDescription && (
              <span className="inline-flex items-center gap-1 rounded-md bg-trade/10 text-trade px-2 py-0.5 text-[11px] font-medium">
                <ArrowLeftRight className="h-3 w-3" />
                {listing.tradeDescription.length > 25
                  ? listing.tradeDescription.slice(0, 25) + '…'
                  : listing.tradeDescription}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
