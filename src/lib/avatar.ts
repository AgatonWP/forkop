import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedAvatar = { uri: string; mimeType?: string; width?: number };

export const AVATAR_PERMISSION_DENIED = 'AVATAR_PERMISSION_DENIED';
export const AVATAR_TOO_LARGE = 'AVATAR_TOO_LARGE';

// An avatar is never shown larger than a profile circle, but the picker hands
// over whatever the camera produced — several megabytes of it. Every listing
// card and chat header loads one, so the raw file would cost far more in
// bandwidth than in storage. Re-encoding to 512px JPEG lands at roughly
// 40-80 kB regardless of the source, and it drops the photo's EXIF data
// (including GPS coordinates) on the way, which has no business being in a
// public bucket.
const AVATAR_PIXEL_SIZE = 512;
const AVATAR_QUALITY = 0.7;
const AVATAR_FILE_NAME = 'avatar.jpg';

/** A backstop only: nothing that went through toUploadableJpeg() comes close. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

async function toUploadableJpeg(image: PickedAvatar): Promise<string> {
  const context = ImageManipulator.manipulate(image.uri);

  // Upscaling a small picture would only make the file bigger.
  if (!image.width || image.width > AVATAR_PIXEL_SIZE) {
    context.resize({ width: AVATAR_PIXEL_SIZE });
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: AVATAR_QUALITY, format: SaveFormat.JPEG });

  return result.uri;
}

/**
 * Earlier versions stored the file under the source image's own extension, so
 * an account that switched from PNG to JPEG left the old file behind forever.
 * Never let this failure stop an upload that already succeeded.
 */
async function removeStaleAvatars(userId: string) {
  try {
    const { data } = await supabase.storage.from('avatars').list(userId);
    const stale = (data ?? [])
      .filter((file) => file.name !== AVATAR_FILE_NAME)
      .map((file) => `${userId}/${file.name}`);

    if (stale.length > 0) {
      await supabase.storage.from('avatars').remove(stale);
    }
  } catch {
    // The new avatar is already live; a leftover file is not worth an error.
  }
}

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
  return { uri: asset.uri, mimeType: asset.mimeType ?? undefined, width: asset.width };
}

export async function uploadAvatarImage(userId: string, image: PickedAvatar): Promise<string> {
  const path = `${userId}/${AVATAR_FILE_NAME}`;

  const response = await fetch(await toUploadableJpeg(image));
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
    throw new Error(AVATAR_TOO_LARGE);
  }

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  await removeStaleAvatars(userId);

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
