import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ArrowLeft, CheckCircle, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import NationEmblem from '@/components/NationEmblem';
import { getNation } from '@/lib/nations';
import { useAuth } from '@/lib/auth';
import { fetchMyListings, markListingSold, deleteListing } from '@/lib/listings';
import { Listing } from '@/lib/types';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function Profile() {
  const { t, lang } = useI18n();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const sv = lang === 'sv';

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchMyListings(user.id);
      setListings(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) refresh();
  }, [user, authLoading, navigate, refresh]);

  const handleMarkSold = async (id: string) => {
    try {
      await markListingSold(id);
      setListings(prev => prev.map(l => l.id === id ? { ...l, isSold: true } : l));
      toast.success(t('listings.sold'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteListing(id);
      setListings(prev => prev.filter(l => l.id !== id));
      toast.success(sv ? 'Borttagen' : 'Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const confirmSignOut = async () => {
    setSignOutOpen(false);
    try {
      await signOut();
      toast.success(sv ? 'Utloggad' : 'Signed out');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const activeListings = listings.filter(l => !l.isSold);
  const soldListings = listings.filter(l => l.isSold);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex items-center h-14 gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-display font-bold text-foreground">{t('profile.title')}</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-bold text-foreground truncate">
              {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Student'}
            </h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSignOutOpen(true)}
            className="gap-1.5 shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{sv ? 'Logga ut' : 'Sign out'}</span>
          </Button>
        </div>

        <section>
          <h3 className="font-display font-semibold text-foreground mb-3">
            {t('profile.activeListings')} ({activeListings.length})
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{sv ? 'Laddar...' : 'Loading...'}</p>
          ) : activeListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.noListings')}</p>
          ) : (
            <div className="space-y-2">
              {activeListings.map(listing => {
                const nation = getNation(listing.nationId);
                return (
                  <div key={listing.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    <NationEmblem nationId={listing.nationId} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{listing.eventName}</p>
                      <p className="text-xs text-muted-foreground">{nation.name} · {listing.quantity} st</p>
                    </div>
                    {listing.dealType === 'trade' && (
                      <Badge className="bg-trade text-trade-foreground border-0 text-xs">{t('listing.trade')}</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMarkSold(listing.id)} title={t('listing.markSold')}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(listing.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h3 className="font-display font-semibold text-foreground mb-3">
            {t('profile.soldListings')} ({soldListings.length})
          </h3>
          {soldListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.noListings')}</p>
          ) : (
            <div className="space-y-2">
              {soldListings.map(listing => (
                <div key={listing.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 opacity-60">
                  <NationEmblem nationId={listing.nationId} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{listing.eventName}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{t('listings.sold')}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(listing.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        title={sv ? 'Ta bort annonsen?' : 'Delete listing?'}
        description={sv ? 'Det här går inte att ångra.' : 'This action cannot be undone.'}
        confirmLabel={sv ? 'Ta bort' : 'Delete'}
        cancelLabel={sv ? 'Avbryt' : 'Cancel'}
        destructive
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={sv ? 'Logga ut?' : 'Sign out?'}
        confirmLabel={sv ? 'Logga ut' : 'Sign out'}
        cancelLabel={sv ? 'Avbryt' : 'Cancel'}
        onConfirm={confirmSignOut}
      />
    </div>
  );
}
