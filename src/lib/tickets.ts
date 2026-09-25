import { OrganizerKind, getNation } from '@/lib/nations';
import { TranslationKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Postgres speaks in constraint names and SQLSTATEs ("new row violates
 * row-level security policy for table \"listings\""). None of that belongs on
 * a user's screen, so every failure a listing insert can produce is named
 * here. 23W02/23W03 are ours, raised by the triggers in
 * 20260916120000_content_limits.sql.
 */
export function listingErrorKey(error: unknown): TranslationKey {
  const code = (error as { code?: string } | null)?.code;

  switch (code) {
    case '42501':
      return 'listingSessionExpired';
    case '23514':
    case '22001':
    case '23502':
      return 'listingInvalidContent';
    case '23W02':
      return 'listingRateLimited';
    case '23W03':
      return 'listingLimitReached';
    case '23W08':
      return 'listingQuantityLimited';
    default:
      return 'listingCreateError';
  }
}

export function describeListingError(error: unknown, t: (key: TranslationKey) => string): string {
  return t(listingErrorKey(error));
}

export type DealType = 'sell' | 'trade' | 'both';

/**
 * Which way a listing points. An offer has tickets to give; a wanted post is
 * someone looking for them. deal_type keeps its three values for both: on a
 * wanted post 'sell' reads as "pays money" and trade_description as what the
 * poster can give in exchange.
 */
export type ListingDirection = 'offer' | 'wanted';

export type Listing = {
  id: string;
  userId: string;
  direction: ListingDirection;
  eventName: string;
  ticketType: string;
  eventDate?: string;
  quantity: number;
  dealType: DealType;
  price?: number;
  tradeDescription?: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  isHot?: boolean;
  isSold?: boolean;
  nationId: string;
  sellerName?: string;
  sellerAvatarUrl?: string;
};

/**
 * Everyday ticket types by kind of organizer. Nations and clubs sell förköp but
 * have no eftersläpp; the LTH sections sell eftersläpp and sittningar rather
 * than förköp. Everyone else — venues, and "Annat" — gets the general pair.
 * The first of each list is what the form falls back to, and it adds the
 * free-text 'Annan' last.
 */
const GENERAL_TICKET_TYPES = ['Förköp', 'Eftersläpp'];
const KIND_TICKET_TYPES: Record<OrganizerKind, string[]> = {
  nation: ['Förköp'],
  section: ['Eftersläpp', 'Sittning'],
  club: ['Förköp'],
};

type OrganizerTicketTypes = {
  types: string[];
  /**
   * Picking the organizer selects the first of these, for organizers where
   * that is nearly always what is being sold. Otherwise the form stays on the
   * everyday type and these are just offered at the top of the list.
   */
  preselect?: boolean;
  /**
   * The last day a one-off event is offered, as YYYY-MM-DD. After it the types
   * drop out of the form and the filter on their own, so single nights can be
   * added here without the lists growing term by term. Listings already posted
   * keep showing their type; they expire with their own date anyway.
   */
  until?: string;
};

/**
 * Types particular to one organizer, offered first once it is picked.
 * Lundakarnevalen's Efterkarnevalen was being posted as "Förköp" with its real
 * name buried in the description, where neither the ticket filter nor search
 * could reach it. Add an organizer here when it sells something its everyday
 * types do not describe.
 */
const ORGANIZER_TICKET_TYPES: Record<string, OrganizerTicketTypes> = {
  karneval: { types: ['Efterkarnevalen'], preselect: true },
  // Maskinsektionen's eftersläpp at Gasquesalen on 30 September 2026.
  maskinsektionen: { types: ['Sensation RED'], until: '2026-09-30' },
  // Malmö Nation's autumn event goes by both names; one type carrying both
  // lets search find it under either.
  malmo: { types: ['September Haze (Höstyran)'] },
};

/** The organizer's own types, minus any one-off event whose night has passed. */
function specialTicketTypesFor(organizerId: string | null | undefined) {
  const special = organizerId ? ORGANIZER_TICKET_TYPES[organizerId] : undefined;
  if (!special) return undefined;
  return !special.until || toLocalDateId(new Date()) <= special.until ? special : undefined;
}

function everydayTicketTypesFor(organizerId: string | null | undefined) {
  const kind = organizerId ? getNation(organizerId).kind : undefined;
  return kind ? KIND_TICKET_TYPES[kind] : GENERAL_TICKET_TYPES;
}

export function ticketTypesFor(organizerId: string | null | undefined): string[] {
  return [...(specialTicketTypesFor(organizerId)?.types ?? []), ...everydayTicketTypesFor(organizerId)];
}

/** The type the form starts on, or falls back to, for this organizer. */
export function defaultTicketTypeFor(organizerId: string | null | undefined): string {
  return everydayTicketTypesFor(organizerId)[0];
}

/** The type to select when this organizer is picked, if it has one. */
export function preselectedTicketTypeFor(organizerId: string): string | null {
  const special = specialTicketTypesFor(organizerId);
  return special?.preselect ? special.types[0] : null;
}

/**
 * Every ticket type the feed's filter offers. Eftersläpp stays even though
 * nations no longer offer it: sections do, and older nation listings still
 * carry it.
 */
export const FILTERABLE_TICKET_TYPES = [
  ...new Set([
    ...GENERAL_TICKET_TYPES,
    ...Object.values(KIND_TICKET_TYPES).flat(),
    ...Object.keys(ORGANIZER_TICKET_TYPES).flatMap((id) => specialTicketTypesFor(id)?.types ?? []),
  ]),
];

export const MAX_EXACT_TICKET_QUANTITY = 20;
/** The number that means "more than 20", which is as far as a private seller goes. */
export const MORE_THAN_MAX_TICKET_QUANTITY = MAX_EXACT_TICKET_QUANTITY + 1;
/**
 * An official account says exactly how many it has, up to this many: they come
 * by whole batches honestly. Held to it by the database as well, see
 * 20260925090000_official_accounts.sql.
 */
export const MAX_OFFICIAL_TICKET_QUANTITY = 50;

/** How high the quantity picker goes for this account. */
export function maxTicketQuantityFor(isOfficialAccount: boolean) {
  return isOfficialAccount ? MAX_OFFICIAL_TICKET_QUANTITY : MORE_THAN_MAX_TICKET_QUANTITY;
}

export function formatRelativeTime(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));

  if (minutes < 60) return `${minutes} min sedan`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;

  const days = Math.round(hours / 24);
  return `${days} d sedan`;
}

/**
 * The organizer's display name for a listing. For known nations/sections this
 * is just their name; for a custom ("Annat") organizer, nationId alone only
 * resolves to the generic placeholder "Annat", so the real free-text name
 * (baked into eventName as "<organizer> – <ticketType>" at post time) is
 * recovered from there instead.
 */
export function getListingOrganizerName(listing: Listing) {
  if (listing.nationId !== 'other') {
    return getNation(listing.nationId).name;
  }

  const separatorIndex = listing.eventName.indexOf(' – ');
  return separatorIndex === -1 ? listing.eventName : listing.eventName.slice(0, separatorIndex);
}

/**
 * Who is actually buying and selling in a conversation about a listing.
 * conversations.seller_id is always the listing's owner and buyer_id the person
 * who got in touch — names from before wanted posts existed, kept because
 * renaming the columns would break every app version already installed. On a
 * wanted post the owner is the buyer, so the two swap. Anything that cares who
 * pays — Swish, role badges, ratings — should ask here rather than compare ids.
 */
export function conversationRoles(
  listing: Pick<Listing, 'direction'>,
  conversation: { buyerId: string; sellerId: string },
): { buyerId: string; sellerId: string } {
  return listing.direction === 'wanted'
    ? { buyerId: conversation.sellerId, sellerId: conversation.buyerId }
    : { buyerId: conversation.buyerId, sellerId: conversation.sellerId };
}

/** 21 is the private seller's "20+"; an official account's 22 to 50 are exact. */
export function formatTicketQuantity(quantity: number) {
  return quantity === MORE_THAN_MAX_TICKET_QUANTITY
    ? `${MAX_EXACT_TICKET_QUANTITY}+`
    : String(quantity);
}

type ListingRow = {
  id: string;
  user_id: string;
  direction: ListingDirection | null;
  event_name: string;
  ticket_type: string;
  event_date: string | null;
  quantity: number;
  deal_type: DealType;
  price: number | string | null;
  trade_description: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  nation_id: string;
  status: 'active' | 'sold' | 'archived';
  seller_name: string | null;
  seller_avatar_url: string | null;
};

const LISTING_COLUMNS =
  'id,user_id,direction,event_name,ticket_type,event_date,quantity,deal_type,price,trade_description,description,created_at,updated_at,nation_id,status,seller_name,seller_avatar_url';

// The same list from before wanted posts existed. Kept so that an app built
// with them still shows every offer against a database where
// 20260921090000_wanted_listings.sql has not been run yet — otherwise
// releasing the app first would empty the feed for everyone who updates.
const LEGACY_LISTING_COLUMNS = LISTING_COLUMNS.replace('direction,', '');

type ListingQueryResult = PromiseLike<{
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}>;

async function selectListings(query: (columns: string) => ListingQueryResult): Promise<Listing[]> {
  let { data, error } = await query(LISTING_COLUMNS);

  // 42703: undefined column — the database predates wanted posts.
  if (error?.code === '42703') {
    ({ data, error } = await query(LEGACY_LISTING_COLUMNS));
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapListing(row as ListingRow));
}

/** Counting a listing's tickets up or down from the profile. */
export async function updateListingQuantity(
  listingId: string,
  userId: string,
  quantity: number,
): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ quantity })
    .eq('id', listingId)
    .eq('user_id', userId);

  if (error) throw error;
}

export function parseListingEventDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function daysFromToday(dateString: string) {
  const eventDate = parseListingEventDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  return Math.round((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatListingEventDate(dateString?: string, language: 'sv' | 'en' = 'sv') {
  if (!dateString) return '';

  const date = parseListingEventDate(dateString);
  const locale = language === 'sv' ? 'sv-SE' : 'en-GB';

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function mapListing(row: ListingRow): Listing {
  return {
    id: row.id,
    userId: row.user_id,
    direction: row.direction ?? 'offer',
    eventName: row.event_name,
    ticketType: row.ticket_type,
    eventDate: row.event_date ?? undefined,
    quantity: row.quantity,
    dealType: row.deal_type,
    price: row.price == null ? undefined : Number(row.price),
    tradeDescription: row.trade_description ?? undefined,
    description: row.description ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    isSold: row.status === 'sold',
    nationId: row.nation_id,
    sellerName: row.seller_name ?? undefined,
    sellerAvatarUrl: row.seller_avatar_url ?? undefined,
  };
}

export async function fetchActiveListings(): Promise<Listing[]> {
  return selectListings((columns) =>
    supabase
      .from('listings')
      .select(columns)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  );
}

export async function fetchMyListings(userId: string): Promise<Listing[]> {
  return selectListings((columns) =>
    supabase
      .from('listings')
      .select(columns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchListingsByIds(listingIds: string[]): Promise<Listing[]> {
  if (listingIds.length === 0) return [];

  return selectListings((columns) => supabase.from('listings').select(columns).in('id', listingIds));
}

export const SOLD_LISTING_KEEP_MS = 24 * 60 * 60 * 1000;

export async function markListingSold(listing: Listing): Promise<string> {
  const { error } = await supabase.rpc('mark_listing_sold', { target_listing_id: listing.id });

  if (error) {
    throw new Error(error.message);
  }

  return listing.id;
}

export async function restoreListingActive(listing: Listing): Promise<void> {
  const { error } = await supabase.rpc('restore_listing_active', { target_listing_id: listing.id });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteListing(listingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

/** Admin-only: relies on the "Admins can view/delete any listing" RLS policies. */
export async function fetchAllListingsAdmin(): Promise<Listing[]> {
  return selectListings((columns) =>
    supabase.from('listings').select(columns).order('created_at', { ascending: false }),
  );
}

export async function adminDeleteListing(listingId: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', listingId);

  if (error) {
    throw new Error(error.message);
  }
}
