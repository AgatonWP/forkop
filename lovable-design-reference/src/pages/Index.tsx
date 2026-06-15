import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchFilters, { DealFilter, SortOption } from '@/components/SearchFilters';
import CategoryTabs from '@/components/CategoryTabs';
import ListingCard from '@/components/ListingCard';
import ListingDetailDialog from '@/components/ListingDetailDialog';

import { EventCategory, getEventCategory } from '@/lib/mockData';
import { Listing } from '@/lib/types';
import { Ticket, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { fetchActiveListings, markListingSold, deleteListing } from '@/lib/listings';
import { useAuth } from '@/lib/auth';
import { fetchMyConversations } from '@/lib/chat';

export default function Index() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dealFilter, setDealFilter] = useState<DealFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [category, setCategory] = useState<EventCategory>('all');
  const [eventFilter, setEventFilter] = useState('');
  const [nationFilter, setNationFilter] = useState<string[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [chattedListingIds, setChattedListingIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActiveListings();
      setListings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;

    const loadConversationMarkers = async () => {
      if (!user) {
        setChattedListingIds(new Set());
        return;
      }
      try {
        const conversations = await fetchMyConversations(user.id);
        if (!active) return;
        setChattedListingIds(new Set(conversations.map((conversation) => conversation.listing?.id).filter(Boolean) as string[]));
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : 'Error');
      }
    };

    loadConversationMarkers();
    return () => { active = false; };
  }, [user]);

  const handleCreateListing = (listing: Listing) => {
    setListings(prev => [listing, ...prev]);
  };

  const handleMarkSold = async (id: string) => {
    try {
      await markListingSold(id);
      setListings(prev => prev.filter(l => l.id !== id));
      setSelectedListing(null);
      toast.success(t('listings.sold'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteListing(id);
      setListings(prev => prev.filter(l => l.id !== id));
      setSelectedListing(null);
      toast.success('Borttagen');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const filtered = useMemo(() => {
    let result = listings.filter(l => !l.isSold);

    if (category !== 'all') {
      result = result.filter(l => getEventCategory(l) === category);
    }

    if (nationFilter.length > 0) {
      result = result.filter(l => nationFilter.includes(l.nationId));
    }

    if (eventFilter) {
      const ef = eventFilter.toLowerCase();
      result = result.filter(l => l.eventName.toLowerCase().includes(ef));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => l.eventName.toLowerCase().includes(q));
    }

    if (dealFilter === 'sell') result = result.filter(l => l.dealType === 'sell' || l.dealType === 'both');
    if (dealFilter === 'trade') result = result.filter(l => l.dealType === 'trade' || l.dealType === 'both');

    if (sortBy === 'newest') {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    if (sortBy === 'oldest') {
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return result;
  }, [listings, search, dealFilter, sortBy, category, nationFilter, eventFilter]);

  const isOwner = (listing: Listing | null) =>
    !!(user && listing && (listing as Listing & { userId?: string }).userId === user.id);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onCreateListing={handleCreateListing} />
      <main className="container flex-1 py-4 space-y-4">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          <CategoryTabs
            active={category}
            onChange={setCategory}
            listings={listings}
            eventFilter={eventFilter}
            onEventFilterChange={setEventFilter}
            compact
          />
          <SearchFilters
            search={search} onSearchChange={setSearch}
            dealFilter={dealFilter} onDealFilterChange={setDealFilter}
            sortBy={sortBy} onSortChange={setSortBy}
            nationFilter={nationFilter} onNationFilterChange={setNationFilter}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground text-center">
            {filtered.length} {filtered.length !== 1 ? t('listings.count') : t('listings.countSingle')}
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="font-display text-lg font-semibold text-muted-foreground">{t('listings.noResults')}</p>
            <p className="text-sm text-muted-foreground/70">{t('listings.noResultsSub')}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((listing, i) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                index={i}
                hasActiveChat={chattedListingIds.has(listing.id)}
                onClick={() => setSelectedListing(listing)}
              />
            ))}
          </div>
        )}
      </main>

      <ListingDetailDialog
        listing={selectedListing}
        open={!!selectedListing}
        onOpenChange={(open) => { if (!open) setSelectedListing(null); }}
        isMatch={false}
        isOwner={isOwner(selectedListing)}
        onMarkSold={handleMarkSold}
        onDelete={handleDelete}
      />
      <Footer />
    </div>
  );
}
