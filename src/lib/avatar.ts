import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Du behöver tillåta åtkomst till bildbiblioteket för att byta profilbild.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  const path = `${userId}/avatar.${extension}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: asset.mimeType ?? 'image/jpeg',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path);

  // Cache-bust so the new avatar shows up immediately instead of a stale CDN copy.
  const cacheBustedUrl = `${publicUrl}?updated=${Date.now()}`;

  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: cacheBustedUrl },
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  return cacheBustedUrl;
}
