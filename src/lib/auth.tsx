import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  initializing: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile?: { fullName?: string },
  ) => Promise<{ userId: string; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const googleConfig = Constants.expoConfig?.extra?.google as
  | { webClientId?: string; iosClientId?: string }
  | undefined;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }
      },
      async signInWithApple() {
        let credential: AppleAuthentication.AppleAuthenticationCredential;

        try {
          credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
        } catch (error) {
          // Dismissing Apple's sheet isn't a failure worth surfacing.
          if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
          throw error;
        }

        if (!credential.identityToken) {
          throw new Error('Apple returned no identity token');
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          throw error;
        }

        // Apple sends the name only on the very first sign-in, so it has to be
        // stored now or the account is left without a display name forever.
        const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(' ');

        if (fullName && !data.user?.user_metadata?.full_name) {
          await supabase.auth.updateUser({ data: { full_name: fullName } });
        }
      },
      async signInWithGoogle() {
        GoogleSignin.configure({
          webClientId: googleConfig?.webClientId,
          iosClientId: googleConfig?.iosClientId,
        });

        const response = await GoogleSignin.signIn();

        // Backing out of Google's sheet isn't a failure worth surfacing.
        if (!isSuccessResponse(response)) return;

        const idToken = response.data.idToken;
        if (!idToken) {
          throw new Error('Google returned no id token');
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) {
          throw error;
        }

        // Fill in name and picture from Google, but never overwrite what the
        // user has already set themselves in the app.
        const metadata = data.user?.user_metadata;
        const fullName = metadata?.full_name ?? response.data.user.name ?? undefined;
        const avatarUrl = metadata?.avatar_url ?? response.data.user.photo ?? undefined;

        if (fullName !== metadata?.full_name || avatarUrl !== metadata?.avatar_url) {
          await supabase.auth.updateUser({ data: { full_name: fullName, avatar_url: avatarUrl } });
        }
      },
      async resetPasswordForEmail(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: Linking.createURL('reset-password'),
        });

        if (error) {
          throw error;
        }
      },
      async signUp(email, password, profile) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: Linking.createURL('auth-redirect'),
            data: {
              full_name: profile?.fullName || undefined,
            },
          },
        });

        if (error) {
          throw error;
        }
        if (!data.user) {
          throw new Error('Kunde inte skapa kontot.');
        }

        // With "Confirm email" enabled in Supabase, signUp succeeds but
        // returns no session until the user clicks the emailed link.
        return { userId: data.user.id, needsEmailConfirmation: !data.session };
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();

        if (error) {
          throw error;
        }
      },
    }),
    [initializing, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
