import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

// Official organizer accounts (nations etc.), granted manually by an admin.
// Deliberately separate from any future student verification: this only ever
// means "this account is the organizer itself".

export type VerifiedOrganizerAccount = {
  userId: string;
  email: string;
  organizerId: string;
  verifiedAt: Date;
};

export const NO_ACCOUNT_WITH_EMAIL = 'NO_ACCOUNT_WITH_EMAIL';

async function fetchVerifiedOrganizers(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('verified_organizers').select('user_id,organizer_id');
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.user_id as string, row.organizer_id as string]));
}

export async function adminListVerifiedOrganizers(): Promise<VerifiedOrganizerAccount[]> {
  const { data, error } = await supabase.rpc('admin_list_verified_organizers');
  if (error) throw new Error(error.message);

  return ((data ?? []) as { user_id: string; email: string; organizer_id: string; verified_at: string }[]).map(
    (row) => ({
      userId: row.user_id,
      email: row.email,
      organizerId: row.organizer_id,
      verifiedAt: new Date(row.verified_at),
    }),
  );
}

export async function adminVerifyOrganizer(email: string, organizerId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_verify_organizer', {
    p_email: email,
    p_organizer_id: organizerId,
  });

  if (error) {
    throw new Error(error.message.includes('no account with that email') ? NO_ACCOUNT_WITH_EMAIL : error.message);
  }
}

export async function adminRevokeOrganizer(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_organizer', { p_user_id: userId });
  if (error) throw new Error(error.message);
}

type VerifiedOrganizersContextValue = {
  verifiedOrganizerIdFor: (userId: string) => string | undefined;
  /** Only true when the seller is the verified account for the listing's own organizer. */
  isVerifiedOrganizerListing: (listing: { userId: string; nationId: string }) => boolean;
  refresh: () => void;
};

const VerifiedOrganizersContext = createContext<VerifiedOrganizersContextValue | null>(null);

export function VerifiedOrganizersProvider({ children }: { children: ReactNode }) {
  const [organizerByUser, setOrganizerByUser] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    try {
      setOrganizerByUser(await fetchVerifiedOrganizers());
    } catch {
      // Keep the last known set; badges catch up on the next refresh.
    }
  }, []);

  useEffect(() => {
    refresh();
    // So a newly verified nation sees its badge without force-quitting the app.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo<VerifiedOrganizersContextValue>(
    () => ({
      verifiedOrganizerIdFor: (userId) => organizerByUser.get(userId),
      isVerifiedOrganizerListing: (listing) => organizerByUser.get(listing.userId) === listing.nationId,
      refresh,
    }),
    [organizerByUser, refresh],
  );

  return <VerifiedOrganizersContext.Provider value={value}>{children}</VerifiedOrganizersContext.Provider>;
}

export function useVerifiedOrganizers() {
  const context = useContext(VerifiedOrganizersContext);

  if (!context) {
    throw new Error('useVerifiedOrganizers must be used inside VerifiedOrganizersProvider');
  }

  return context;
}
