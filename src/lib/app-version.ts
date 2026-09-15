const APP_STORE_ID = '6805922743';

export const APP_STORE_URL = 'https://apps.apple.com/se/app/f%C3%B6rk%C3%B6p-lund/id6805922743';

/**
 * Compares dotted version strings numerically, so 1.10.0 > 1.9.0 (a plain
 * string compare gets that wrong). Missing segments count as 0, so 1.0 equals
 * 1.0.0. Returns a positive number if a is newer, negative if b is, else 0.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.trim().split('.').map((part) => parseInt(part, 10) || 0);
  const partsB = b.trim().split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

export async function fetchAppStoreVersion(): Promise<string | null> {
  // The timestamp busts Apple's CDN cache, which can serve the previous
  // version for hours after a release goes live.
  const response = await fetch(
    `https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=se&t=${Date.now()}`,
  );
  if (!response.ok) return null;

  const json = await response.json();
  const version = json?.results?.[0]?.version;
  return typeof version === 'string' ? version : null;
}
