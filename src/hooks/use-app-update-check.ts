import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

import { APP_STORE_URL, compareVersions, fetchAppStoreVersion } from '@/lib/app-version';
import { useI18n } from '@/lib/i18n';

const LAST_PROMPT_KEY = 'forkop-update-prompt-shown-at';
const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * On launch and whenever the app returns to the foreground, prompts to update
 * if the App Store has a newer version — at most once per day, so tapping
 * "Later" isn't undone by simply switching apps.
 */
export function useAppUpdateCheck() {
  const { t } = useI18n();
  // Read through a ref so a language switch doesn't re-subscribe and re-prompt.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let checking = false;
    let alertOpen = false;

    async function check() {
      const installed = Constants.expoConfig?.version;
      if (!installed || checking || alertOpen) return;

      checking = true;
      try {
        // Checked before the network call so a throttled activation costs nothing.
        const lastShownAt = Number(await AsyncStorage.getItem(LAST_PROMPT_KEY));
        if (Date.now() - lastShownAt < PROMPT_INTERVAL_MS) return;

        const latest = await fetchAppStoreVersion();
        if (!latest || compareVersions(latest, installed) <= 0) return;

        await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));

        const translate = tRef.current;
        alertOpen = true;
        Alert.alert(translate('updateAvailableTitle'), translate('updateAvailableMessage'), [
          {
            text: translate('updateLater'),
            style: 'cancel',
            onPress: () => {
              alertOpen = false;
            },
          },
          {
            text: translate('updateNow'),
            onPress: () => {
              alertOpen = false;
              Linking.openURL(APP_STORE_URL);
            },
          },
        ]);
      } catch {
        // Offline or the lookup failed: skip quietly, the next activation retries.
      } finally {
        checking = false;
      }
    }

    // The 'change' event doesn't fire for the initial state, so check once on mount too.
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => subscription.remove();
  }, []);
}
