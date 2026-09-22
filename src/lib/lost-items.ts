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
  'id',
  'headphones',
  'bag',
  'jewelry',
  'watch',
  'clothing',
  'other',
] as const;

export type LostItemCategory = (typeof LOST_ITEM_CATEGORIES)[number];

function isLostItemCategory(value: string): value is LostItemCategory {
  return (LOST_ITEM_CATEGORIES as readonly string[]).includes(value);
}

/** Read at a glance in a list, which a row of eleven words would not be. */
export const LOST_ITEM_CATEGORY_EMOJI: Record<LostItemCategory, string> = {
  jacket: '🧥',
  phone: '📱',
  keys: '🔑',
  wallet: '👛',
  id: '🪪',
  headphones: '🎧',
  bag: '🎒',
  jewelry: '💍',
  watch: '⌚',
  clothing: '👕',
  other: '❓',
};

export const LOST_ITEM_CATEGORY_KEY: Record<LostItemCategory, TranslationKey> = {
  jacket: 'lostCategoryJacket',
  phone: 'lostCategoryPhone',
  keys: 'lostCategoryKeys',
  wallet: 'lostCategoryWallet',
  id: 'lostCategoryId',
  headphones: 'lostCategoryHeadphones',
  bag: 'lostCategoryBag',
  jewelry: 'lostCategoryJewelry',
  watch: 'lostCategoryWatch',
  clothing: 'lostCategoryClothing',
  other: 'lostCategoryOther',
};

/** Mirrors the check constraint on lost_items.item_name. */
export const MAX_LOST_ITEM_NAME = 40;

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
  /** Free text under "Annat" in "Vad?", like "paraply". */
  itemName?: string;
  nationId: string;
  /** Free text under "Annat" in "Var?", like "utanför Clemens Falafel". */
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
  category: string;
  item_name?: string | null;
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
  'id,user_id,kind,category,item_name,nation_id,place,happened_on,description,status,reporter_name,reporter_avatar_url,created_at';

// The same list from before item names and places existed, so the feed still
// loads against a database where 20260922090000_lost_item_place.sql and
// 20260922120000_lost_item_categories.sql have not been run yet.
const LEGACY_LOST_ITEM_COLUMNS = LOST_ITEM_COLUMNS.replace('item_name,', '').replace('place,', '');

type LostItemQueryResult = PromiseLike<{
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}>;

async function selectLostItems(query: (columns: string) => LostItemQueryResult): Promise<LostItem[]> {
  let { data, error } = await query(LOST_ITEM_COLUMNS);

  // 42703: undefined column — the database predates item names or places.
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
    // A category added after this app version was built reads as "Annat"
    // rather than as a blank card.
    category: isLostItemCategory(row.category) ? row.category : 'other',
    itemName: row.item_name ?? undefined,
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

/** What a post is about: its free-text name when it has one, else the category. */
export function lostItemTitle(item: LostItem, t: (key: TranslationKey) => string) {
  return item.itemName ?? t(LOST_ITEM_CATEGORY_KEY[item.category]);
}

/** Where a post is from: its free-text place when it has one, else the nation. */
export function lostItemPlaceName(item: LostItem) {
  return item.place ?? getNation(item.nationId).name;
}

export async function createLostItem(input: {
  userId: string;
  kind: LostItemKind;
  category: LostItemCategory;
  itemName?: string;
  nationId: string;
  place?: string;
  happenedOn: string;
  description?: string;
  reporterName?: string;
  reporterAvatarUrl?: string;
}): Promise<LostItem> {
  const itemName = input.itemName?.trim();
  const place = input.place?.trim();
  // Item name and place, and their columns, go in only when there is one, so
  // a post without them still saves before their migrations have run.
  const { data, error } = await supabase
    .from('lost_items')
    .insert({
      user_id: input.userId,
      kind: input.kind,
      category: input.category,
      ...(itemName ? { item_name: itemName } : {}),
      nation_id: input.nationId,
      ...(place ? { place } : {}),
      happened_on: input.happenedOn,
      description: input.description?.trim() || null,
      reporter_name: input.reporterName ?? null,
      reporter_avatar_url: input.reporterAvatarUrl ?? null,
    })
    .select(itemName || place ? LOST_ITEM_COLUMNS : LEGACY_LOST_ITEM_COLUMNS)
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
