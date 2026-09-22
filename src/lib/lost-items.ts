import { TranslationKey } from '@/lib/i18n';
import { getNation } from '@/lib/nations';
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

/** Mirrors the check constraint on lost_items.place. */
export const MAX_LOST_ITEM_PLACE = 60;

/** How far back the form lets you pick an evening. */
export const LOST_ITEM_DAYS_BACK = 14;

export type LostItem = {
  id: string;
  userId: string;
  kind: LostItemKind;
  category: LostItemCategory;
  nationId: string;
  /** Free text under "Annat", like "utanför Clemens Falafel". */
  place?: string;
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
  place?: string | null;
  happened_on: string;
  description: string | null;
  status: 'open' | 'resolved';
  reporter_name: string | null;
  reporter_avatar_url: string | null;
  created_at: string;
};

const LOST_ITEM_COLUMNS =
  'id,user_id,kind,category,nation_id,place,happened_on,description,status,reporter_name,reporter_avatar_url,created_at';

// The same list from before places existed, so the feed still loads against a
// database where 20260922090000_lost_item_place.sql has not been run yet.
const LEGACY_LOST_ITEM_COLUMNS = LOST_ITEM_COLUMNS.replace('place,', '');

type LostItemQueryResult = PromiseLike<{
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}>;

async function selectLostItems(query: (columns: string) => LostItemQueryResult): Promise<LostItem[]> {
  let { data, error } = await query(LOST_ITEM_COLUMNS);

  // 42703: undefined column — the database predates places.
  if (error?.code === '42703') {
    ({ data, error } = await query(LEGACY_LOST_ITEM_COLUMNS));
  }

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapLostItem(row as LostItemRow));
}

function mapLostItem(row: LostItemRow): LostItem {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    category: row.category,
    nationId: row.nation_id,
    place: row.place ?? undefined,
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
  return selectLostItems((columns) =>
    supabase
      .from('lost_items')
      .select(columns)
      .eq('status', 'open')
      .order('happened_on', { ascending: false })
      .order('created_at', { ascending: false }),
  );
}

export async function fetchLostItemsByIds(ids: string[]): Promise<LostItem[]> {
  if (ids.length === 0) return [];

  return selectLostItems((columns) => supabase.from('lost_items').select(columns).in('id', ids));
}

/** Where a post is from: its free-text place when it has one, else the nation. */
export function lostItemPlaceName(item: LostItem) {
  return item.place ?? getNation(item.nationId).name;
}

export async function createLostItem(input: {
  userId: string;
  kind: LostItemKind;
  category: LostItemCategory;
  nationId: string;
  place?: string;
  happenedOn: string;
  description?: string;
  reporterName?: string;
  reporterAvatarUrl?: string;
}): Promise<LostItem> {
  const place = input.place?.trim();
  // The place and its column go in only when there is one, so a post without
  // a place still saves before 20260922090000_lost_item_place.sql has run.
  const { data, error } = await supabase
    .from('lost_items')
    .insert({
      user_id: input.userId,
      kind: input.kind,
      category: input.category,
      nation_id: input.nationId,
      ...(place ? { place } : {}),
      happened_on: input.happenedOn,
      description: input.description?.trim() || null,
      reporter_name: input.reporterName ?? null,
      reporter_avatar_url: input.reporterAvatarUrl ?? null,
    })
    .select(place ? LOST_ITEM_COLUMNS : LEGACY_LOST_ITEM_COLUMNS)
    .single();

  if (error) throw error;

  return mapLostItem(data as unknown as LostItemRow);
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

/** Admin-only: relies on the "Admins can delete any lost item" RLS policy. */
export async function adminDeleteLostItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('lost_items').delete().eq('id', itemId);

  if (error) throw error;
}
