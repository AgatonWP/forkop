import { supabase } from '@/lib/supabase';

export async function fetchOwnSwishNumber(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('seller_payment_details')
    .select('swish_number')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.swish_number ?? '';
}

export const INVALID_SWISH_NUMBER = 'INVALID_SWISH_NUMBER';

/** Mirrors the check constraint on seller_payment_details, so a bad number
 *  fails with a readable message instead of a raw Postgres constraint error. */
function isValidSwishNumber(value: string): boolean {
  return value.length >= 7 && value.length <= 24 && /^\+?[0-9][0-9 +()-]*$/.test(value);
}

export async function saveOwnSwishNumber(userId: string, swishNumber: string): Promise<void> {
  const normalized = swishNumber.trim();

  if (!normalized) {
    const { error } = await supabase.from('seller_payment_details').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  if (!isValidSwishNumber(normalized)) {
    throw new Error(INVALID_SWISH_NUMBER);
  }

  const { error } = await supabase.from('seller_payment_details').upsert({
    user_id: userId,
    swish_number: normalized,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

/** RLS returns a value only to the seller or to a buyer with a real conversation. */
export async function fetchSellerSwishNumber(sellerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('seller_payment_details')
    .select('swish_number')
    .eq('user_id', sellerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.swish_number ?? null;
}
