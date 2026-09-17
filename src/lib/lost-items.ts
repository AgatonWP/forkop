import { TranslationKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

// Lost and found. Both directions exist because the person holding the answer
// is usually the one who found something, not the one who lost it — see
// supabase/migrations/20260917090000_create_lost_items.sql, where a matching
// post in the other direction sends a push on its own.

export type LostItemKind = 'lost' | 'found';

export const LOST_ITEM_CATEGORIES = [
  'jacket',
  'phone',
  'keys',
  'wallet',
  'headphones',
  'bag',
  'jewelry',
  'clothing',
  'other',
] as const;

export type LostItemCategory = (typeof LOST_ITEM_CATEGORIES)[number];

/** Read at a glance in a list, which a row of nine words would not be. */
export const LOST_ITEM_CATEGORY_EMOJI: Record<LostItemCategory, string> = {
  jacket: '🧥',
  phone: '📱',
  keys: '🔑',
  wallet: '👛',
  headphones: '🎧',
  bag: '🎒',
  jewelry: '💍',
  clothing: '👕',
  other: '❓',
};

export const LOST_ITEM_CATEGORY_KEY: Record<LostItemCategory, TranslationKey> = {
  jacket: 'lostCategoryJacket',
  phone: 'lostCategoryPhone',
  keys: 'lostCategoryKeys',
  wallet: 'lostCategoryWallet',
  headphones: 'lostCategoryHeadphones',
  bag: 'lostCategoryBag',
  jewelry: 'lostCategoryJewelry',
  clothing: 'lostCategoryClothing',
  other: 'lostCategoryOther',
};

/** Mirrors the check constraint on lost_items.description. */
export const MAX_LOST_ITEM_DESCRIPTION = 300;

/** How far back the form lets you pick an evening. */
export const LOST_ITEM_DAYS_BACK = 14;

export type LostItem = {
  id: string;
  userId: string;
  kind: LostItemKind;
  category: LostItemCategory;
  nationId: string;
  happenedOn: string;
  description?: string;
  status: 'open' | 'resolved';
  reporterName?: string;
  reporterAvatarUrl?: string;
  createdAt: Date;
};

type LostItemRow = {
  id: string;
  user_id: string;
  kind: LostItemKind;
  category: LostItemCategory;
  nation_id: string;
  happened_on: string;
  description: string | null;
  status: 'open' | 'resolved';
  reporter_name: string | null;
  reporter_avatar_url: string | null;
  created_at: string;
};

const LOST_ITEM_COLUMNS =
  'id,user_id,kind,category,nation_id,happened_on,description,status,reporter_name,reporter_avatar_url,created_at';

function mapLostItem(row: LostItemRow): LostItem {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    category: row.category,
    nationId: row.nation_id,
    happenedOn: row.happened_on,
    description: row.description ?? undefined,
    status: row.status,
    reporterName: row.reporter_name ?? undefined,
    reporterAvatarUrl: row.reporter_avatar_url ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Postgres speaks in SQLSTATEs; the user gets a sentence. 23W06/23W07 are ours,
 * raised by enforce_lost_item_limits().
 */
export function lostItemErrorKey(error: unknown): TranslationKey {
  switch ((error as { code?: string } | null)?.code) {
    case '42501':
      return 'listingSessionExpired';
    case '23W06':
      return 'lostItemRateLimited';
    case '23W07':
      return 'lostItemLimitReached';
    case '23514':
    case '22001':
      return 'listingInvalidContent';
    default:
      return 'lostItemSaveError';
  }
}

export async function fetchOpenLostItems(): Promise<LostItem[]> {
  const { data, error } = await supabase
    .from('lost_items')
    .select(LOST_ITEM_COLUMNS)
    .eq('status', 'open')
    .order('happened_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapLostItem(row as LostItemRow));
}

export async function fetchLostItemsByIds(ids: string[]): Promise<LostItem[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('lost_items')
    .select(LOST_ITEM_COLUMNS)
    .in('id', ids);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapLostItem(row as LostItemRow));
}

export async function createLostItem(input: {
  userId: string;
  kind: LostItemKind;
  category: LostItemCategory;
  nationId: string;
  happenedOn: string;
  description?: string;
  reporterName?: string;
  reporterAvatarUrl?: string;
}): Promise<LostItem> {
  const { data, error } = await supabase
    .from('lost_items')
    .insert({
      user_id: input.userId,
      kind: input.kind,
      category: input.category,
      nation_id: input.nationId,
      happened_on: input.happenedOn,
      description: input.description?.trim() || null,
      reporter_name: input.reporterName ?? null,
      reporter_avatar_url: input.reporterAvatarUrl ?? null,
    })
    .select(LOST_ITEM_COLUMNS)
    .single();

  if (error) throw error;

  return mapLostItem(data as LostItemRow);
}

export async function resolveLostItem(itemId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('lost_items')
    .update({ status: 'resolved' })
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteLostItem(itemId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('lost_items').delete().eq('id', itemId).eq('user_id', userId);

  if (error) throw error;
}
