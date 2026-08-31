import { supabase } from '@/lib/supabase';

export type Rating = {
  id: string;
  listingId: string;
  raterId: string;
  ratedUserId: string;
  score: number;
  createdAt: Date;
};

type RatingRow = {
  id: string;
  listing_id: string;
  rater_id: string;
  rated_user_id: string;
  score: number;
  created_at: string;
};

const RATING_COLUMNS = 'id,listing_id,rater_id,rated_user_id,score,created_at';

function mapRating(row: RatingRow): Rating {
  return {
    id: row.id,
    listingId: row.listing_id,
    raterId: row.rater_id,
    ratedUserId: row.rated_user_id,
    score: row.score,
    createdAt: new Date(row.created_at),
  };
}

export async function submitRating(
  listingId: string,
  raterId: string,
  ratedUserId: string,
  score: number,
): Promise<void> {
  const { error } = await supabase
    .from('ratings')
    .insert({ listing_id: listingId, rater_id: raterId, rated_user_id: ratedUserId, score });

  if (error) {
    throw new Error(error.message);
  }
}

export type RatingSummary = { average: number; count: number };

export async function fetchRatingSummary(userId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.from('ratings').select('score').eq('rated_user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  const scores = (data ?? []).map((row) => row.score as number);
  if (scores.length === 0) return { average: 0, count: 0 };

  return { average: scores.reduce((sum, score) => sum + score, 0) / scores.length, count: scores.length };
}

/** One rating per listing (unique constraint), keyed by listing id, for the sold-listings list. */
export async function fetchOwnRatingsForListings(listingIds: string[]): Promise<Map<string, Rating>> {
  if (listingIds.length === 0) return new Map();

  const { data, error } = await supabase.from('ratings').select(RATING_COLUMNS).in('listing_id', listingIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [row.listing_id, mapRating(row as RatingRow)]));
}
