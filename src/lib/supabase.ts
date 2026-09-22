import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const noopStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const webStorage = {
  getItem: async (key: string) => window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: async (key: string) => window.localStorage.removeItem(key),
};

const authStorage =
  typeof window === 'undefined'
    ? noopStorage
    : Platform.OS === 'web'
      ? webStorage
      : AsyncStorage;

/**
 * Sent with every request as x-forkop-api, and read by the database through
 * public.client_api_version(). Rows an older app would misread are gated on it
 * — wanted posts need 2, see 20260921090000_wanted_listings.sql; the split
 * lost-item categories and Gasquesalen need 3, see
 * 20260922120000_lost_item_categories.sql — so bump it whenever the schema
 * learns something the version already on people's phones does not know
 * about, and gate the new rows on the new number.
 */
export const CLIENT_API_VERSION = 3;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-forkop-api': String(CLIENT_API_VERSION) },
  },
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE puts the auth code in the redirect URL's query string, which is
    // what lets the password-reset deep link be read with useLocalSearchParams
    // instead of having to hand-parse a URL fragment.
    flowType: 'pkce',
    lock: processLock,
  },
});
