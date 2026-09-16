import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// A watch is a saved filter combination. When a new listing matches it, the
// listings trigger in 20260916090000_create_ticket_watches.sql sends a push.
// The free-text search is deliberately not part of it: it matches loosely on
// event names and nation aliases, so what would notify you stops being
// predictable. A watch therefore needs at least an organizer or a ticket type.

export const MAX_TICKET_WATCHES = 20;

export const WATCH_LIMIT_REACHED = 'WATCH_LIMIT_REACHED';
export const WATCH_ALREADY_EXISTS = 'WATCH_ALREADY_EXISTS';
export const WATCH_NEEDS_SUBJECT = 'WATCH_NEEDS_SUBJECT';

export type TicketWatchFilters = {
  nationId: string | null;
  ticketType: string | null;
  dealType: 'sell' | 'trade' | null;
  eventDates: string[];
};

export type TicketWatch = TicketWatchFilters & {
  id: string;
  createdAt: Date;
};

type TicketWatchRow = {
  id: string;
  nation_id: string | null;
  ticket_type: string | null;
  deal_type: 'sell' | 'trade' | null;
  event_dates: string[] | null;
  created_at: string;
};

const WATCH_COLUMNS = 'id,nation_id,ticket_type,deal_type,event_dates,created_at';

function mapWatch(row: TicketWatchRow): TicketWatch {
  return {
    id: row.id,
    nationId: row.nation_id,
    ticketType: row.ticket_type,
    dealType: row.deal_type,
    eventDates: [...(row.event_dates ?? [])].sort(),
    createdAt: new Date(row.created_at),
  };
}

/** The rule the database enforces too: a date alone would match almost everything. */
export function canBeWatched(filters: TicketWatchFilters) {
  return !!filters.nationId || !!filters.ticketType;
}

export function isSameWatch(a: TicketWatchFilters, b: TicketWatchFilters) {
  return (
    a.nationId === b.nationId &&
    a.ticketType === b.ticketType &&
    a.dealType === b.dealType &&
    [...a.eventDates].sort().join(',') === [...b.eventDates].sort().join(',')
  );
}

export async function fetchTicketWatches(userId: string): Promise<TicketWatch[]> {
  const { data, error } = await supabase
    .from('ticket_watches')
    .select(WATCH_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapWatch(row as TicketWatchRow));
}

export async function createTicketWatch(
  userId: string,
  filters: TicketWatchFilters,
): Promise<TicketWatch> {
  const { data, error } = await supabase
    .from('ticket_watches')
    .insert({
      user_id: userId,
      nation_id: filters.nationId,
      ticket_type: filters.ticketType,
      deal_type: filters.dealType,
      event_dates: filters.eventDates.length > 0 ? [...filters.eventDates].sort() : null,
    })
    .select(WATCH_COLUMNS)
    .single();

  if (error) {
    // Raw Postgres text ("duplicate key value violates unique constraint...")
    // must never reach the screen, so every constraint gets its own case.
    if (error.code === '23505') throw new Error(WATCH_ALREADY_EXISTS);
    if (error.code === '23514') throw new Error(WATCH_NEEDS_SUBJECT);
    if (error.code === '23W01') throw new Error(WATCH_LIMIT_REACHED);
    throw new Error(error.message);
  }

  return mapWatch(data as TicketWatchRow);
}

export async function deleteTicketWatch(watchId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('ticket_watches')
    .delete()
    .eq('id', watchId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

type TicketWatchesContextValue = {
  watches: TicketWatch[];
  loading: boolean;
  refresh: () => Promise<void>;
  addWatch: (filters: TicketWatchFilters) => Promise<TicketWatch>;
  removeWatch: (watchId: string) => Promise<void>;
  /** The saved watch matching these filters exactly, if there is one. */
  findWatch: (filters: TicketWatchFilters) => TicketWatch | undefined;
};

const TicketWatchesContext = createContext<TicketWatchesContextValue | null>(null);

export function TicketWatchesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [watches, setWatches] = useState<TicketWatch[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWatches([]);
      return;
    }

    setLoading(true);
    try {
      setWatches(await fetchTicketWatches(userId));
    } catch {
      // Keep the last known list; the watch screen can retry with a pull.
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWatch = useCallback(
    async (filters: TicketWatchFilters) => {
      if (!userId) throw new Error('not signed in');

      const created = await createTicketWatch(userId, filters);
      setWatches((current) => [created, ...current]);
      return created;
    },
    [userId],
  );

  const removeWatch = useCallback(
    async (watchId: string) => {
      if (!userId) return;

      await deleteTicketWatch(watchId, userId);
      setWatches((current) => current.filter((watch) => watch.id !== watchId));
    },
    [userId],
  );

  const value = useMemo<TicketWatchesContextValue>(
    () => ({
      watches,
      loading,
      refresh,
      addWatch,
      removeWatch,
      findWatch: (filters) => watches.find((watch) => isSameWatch(watch, filters)),
    }),
    [watches, loading, refresh, addWatch, removeWatch],
  );

  return <TicketWatchesContext.Provider value={value}>{children}</TicketWatchesContext.Provider>;
}

export function useTicketWatches() {
  const context = useContext(TicketWatchesContext);

  if (!context) {
    throw new Error('useTicketWatches must be used inside TicketWatchesProvider');
  }

  return context;
}
