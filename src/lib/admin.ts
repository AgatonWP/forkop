import { supabase } from '@/lib/supabase';

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
