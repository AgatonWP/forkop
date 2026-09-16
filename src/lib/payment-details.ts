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

// A Swedish mobile number is 10 digits (0701234567) or 11 with the country
// code (46701234567). 15 is the ceiling because E.164 — the international
// numbering standard — allows no phone number on earth to be longer, country
// code included, so it covers a foreign number connected to Swish as well.
export const MIN_SWISH_DIGITS = 10;
export const MAX_SWISH_DIGITS = 15;

export function countSwishDigits(value: string): number {
  return value.replace(/\D/g, '').length;
}

/** For live feedback in a field the user is still typing in. */
export function hasPlausibleSwishLength(value: string): boolean {
  const digits = countSwishDigits(value);
  return digits >= MIN_SWISH_DIGITS && digits <= MAX_SWISH_DIGITS;
}

/** Mirrors the check constraint on seller_payment_details, so a bad number
 *  fails with a readable message instead of a raw Postgres constraint error. */
function isValidSwishNumber(value: string): boolean {
  return (
    value.length >= 7 &&
    value.length <= 24 &&
    /^\+?[0-9][0-9 +()-]*$/.test(value) &&
    hasPlausibleSwishLength(value)
  );
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
