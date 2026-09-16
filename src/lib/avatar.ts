import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedAvatar = { uri: string; mimeType?: string };

export const AVATAR_PERMISSION_DENIED = 'AVATAR_PERMISSION_DENIED';
export const AVATAR_TOO_LARGE = 'AVATAR_TOO_LARGE';

/** Mirrors the bucket's own limit, so the user hears about it before the upload. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Anything outside this list would end up as a public file with an
// attacker-chosen content type (SVG being the classic one), so unknown types
// are stored as plain JPEG instead.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export async function pickAvatarImage(): Promise<PickedAvatar | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(AVATAR_PERMISSION_DENIED);
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
  return { uri: asset.uri, mimeType: asset.mimeType ?? undefined };
}

export async function uploadAvatarImage(userId: string, image: PickedAvatar): Promise<string> {
  const mimeType = image.mimeType && ALLOWED_MIME_TYPES[image.mimeType] ? image.mimeType : 'image/jpeg';
  const extension = ALLOWED_MIME_TYPES[mimeType];
  const path = `${userId}/avatar.${extension}`;

  const response = await fetch(image.uri);
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
    throw new Error(AVATAR_TOO_LARGE);
  }

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: mimeType,
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

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const picked = await pickAvatarImage();
  if (!picked) return null;

  return uploadAvatarImage(userId, picked);
}
