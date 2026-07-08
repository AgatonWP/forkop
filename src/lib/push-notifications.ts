import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export async function getPushEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.enabled ?? false;
}

export async function registerForPushNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Push-notiser stöds inte i webbläsaren.');
  }

  if (!Device.isDevice) {
    throw new Error('Push-notiser kräver en fysisk enhet.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existingStatus === 'granted' ? existingStatus : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    throw new Error('Du behöver tillåta notiser i telefonens inställningar.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error(
      'Appen saknar ett EAS-projekt-id (kör "eas init"), så ett push-token kan inte hämtas ännu.',
    );
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.from('push_tokens').upsert({
    user_id: userId,
    token,
    enabled: true,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function disablePushNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
