import { supabase } from '@/lib/supabase';

export type DealType = 'sell' | 'trade' | 'both';

export type Listing = {
  id: string;
  userId: string;
  eventName: string;
  ticketType: string;
  quantity: number;
  dealType: DealType;
  price?: number;
  tradeDescription?: string;
  description: string;
  contactMethod: string;
  contactInfo: string;
  createdAt: Date;
  updatedAt: Date;
  isHot?: boolean;
  isSold?: boolean;
  nationId: string;
  sellerName?: string;
};

export const MAX_EXACT_TICKET_QUANTITY = 20;
export const MORE_THAN_MAX_TICKET_QUANTITY = MAX_EXACT_TICKET_QUANTITY + 1;

export function formatRelativeTime(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));

  if (minutes < 60) return `${minutes} min sedan`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;

  const days = Math.round(hours / 24);
  return `${days} d sedan`;
}

export function formatTicketQuantity(quantity: number) {
  return quantity >= MORE_THAN_MAX_TICKET_QUANTITY
    ? `${MAX_EXACT_TICKET_QUANTITY}+`
    : String(quantity);
}

type ListingRow = {
  id: string;
  user_id: string;
  event_name: string;
  ticket_type: string;
  quantity: number;
  deal_type: DealType;
  price: number | string | null;
  trade_description: string | null;
  description: string | null;
  contact_method: string | null;
  contact_info: string | null;
  created_at: string;
  updated_at: string;
  nation_id: string;
  status: 'active' | 'sold' | 'archived';
};

const LISTING_COLUMNS =
  'id,user_id,event_name,ticket_type,quantity,deal_type,price,trade_description,description,contact_method,contact_info,created_at,updated_at,nation_id,status';

function mapListing(row: ListingRow): Listing {
  return {
    id: row.id,
    userId: row.user_id,
    eventName: row.event_name,
    ticketType: row.ticket_type,
    quantity: row.quantity,
    dealType: row.deal_type,
    price: row.price == null ? undefined : Number(row.price),
    tradeDescription: row.trade_description ?? undefined,
    description: row.description ?? '',
    contactMethod: row.contact_method ?? '',
    contactInfo: row.contact_info ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    isSold: row.status === 'sold',
    nationId: row.nation_id,
  };
}

export async function fetchActiveListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_COLUMNS)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapListing(row as ListingRow));
}

export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapListing(row as ListingRow));
}

export async function fetchListingsByIds(listingIds: string[]): Promise<Listing[]> {
  if (listingIds.length === 0) return [];

  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_COLUMNS)
    .in('id', listingIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapListing(row as ListingRow));
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
