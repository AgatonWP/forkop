export type LundEvent = {
  id: string;
  name: string;
  organizer?: string;
  category?: 'valborg' | 'karneval' | 'nation' | 'forkop' | 'other';
};

// Known recurring Lund student events used as fallback (and merged with scraped data)
export const KNOWN_LUND_EVENTS: LundEvent[] = [
  // Valborg
  { id: 'sunwing', name: 'Sunwing', organizer: 'Helsingkrona nation', category: 'valborg' },
  { id: 'yran', name: 'Yran', organizer: 'Lunds nation', category: 'valborg' },
  { id: 'siste-april', name: 'Siste April', category: 'valborg' },
  { id: 'nast-siste-april', name: 'Näst Siste April', category: 'valborg' },
  { id: 'tegelbruket', name: 'Tegelbruket', category: 'valborg' },
  { id: 't-bar', name: 'T-Bar', category: 'valborg' },
  { id: 'skvalborg', name: 'Skvalborg', category: 'valborg' },
  { id: '1-maj', name: '1 Maj', category: 'valborg' },

  // Karneval
  { id: 'dansen', name: 'Dansen', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'spexet', name: 'Spexet', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'grandevalen', name: 'Grandevalen', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'dubbelkvarten', name: 'Dubbelkvarten', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'silent-disco', name: 'Silent Disco', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'beergarden', name: 'Beergarden', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'barnevalen', name: 'Barnevalen', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'zodiacalkarneval', name: 'Zodiakal Karneval', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'tropical-karneval', name: 'Tropical Karneval', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'kabare', name: 'Kabarén', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'revyn', name: 'Revyn', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'showen', name: 'Showen', organizer: 'Lundakarnevalen', category: 'karneval' },
  { id: 'cirkusen', name: 'Cirkusen', organizer: 'Lundakarnevalen', category: 'karneval' },

  // Nations
  { id: 'goteborgs-sittning', name: 'Göteborgs Sittning', organizer: 'Göteborgs nation', category: 'nation' },
  { id: 'goteborgs-pub', name: 'Göteborgs Pub', organizer: 'Göteborgs nation', category: 'nation' },
  { id: 'helsingkrona-sittning', name: 'Helsingkrona Sittning', organizer: 'Helsingkrona nation', category: 'nation' },
  { id: 'lunds-sittning', name: 'Lunds Sittning', organizer: 'Lunds nation', category: 'nation' },
  { id: 'malmo-sittning', name: 'Malmö Sittning', organizer: 'Malmö nation', category: 'nation' },
  { id: 'vg-sittning', name: 'VG Sittning', organizer: 'Västgöta nation', category: 'nation' },
  { id: 'sydskanska-sittning', name: 'Sydskånska Sittning', organizer: 'Sydskånska nation', category: 'nation' },
  { id: 'ostgota-sittning', name: 'Östgöta Sittning', organizer: 'Östgöta nation', category: 'nation' },
  { id: 'blekingska-sittning', name: 'Blekingska Sittning', organizer: 'Blekingska nation', category: 'nation' },
  { id: 'smalands-sittning', name: 'Smålands Sittning', organizer: 'Smålands nation', category: 'nation' },
  { id: 'kalmar-sittning', name: 'Kalmar Sittning', organizer: 'Kalmar nation', category: 'nation' },
  { id: 'kristianstads-sittning', name: 'Kristianstads Sittning', organizer: 'Kristianstads nation', category: 'nation' },
  { id: 'wermlands-sittning', name: 'Wermlands Sittning', organizer: 'Wermlands nation', category: 'nation' },

  // Förköp
  { id: 'forkop-sunwing', name: 'Förköp Sunwing', category: 'forkop' },
  { id: 'forkop-yran', name: 'Förköp Yran', category: 'forkop' },
  { id: 'forkop-dansen', name: 'Förköp Dansen', category: 'forkop' },
  { id: 'forkop-spexet', name: 'Förköp Spexet', category: 'forkop' },
];

let cachedEvents: LundEvent[] | null = null;

// NOTE: Replace this URL with the correct events page you want to scrape.
// stuk.se appears to be a parked domain — update once you know the right URL.
const EVENTS_SCRAPE_URL = 'https://studentlund.se/kalender/';

export async function fetchLundEvents(): Promise<LundEvent[]> {
  if (cachedEvents) return cachedEvents;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(EVENTS_SCRAPE_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const scraped = parseEventsFromHtml(html);

    const merged = [
      ...KNOWN_LUND_EVENTS,
      ...scraped.filter(
        (e) => !KNOWN_LUND_EVENTS.some((k) => k.name.toLowerCase() === e.name.toLowerCase())
      ),
    ];
    cachedEvents = merged;
    return cachedEvents;
  } catch {
    cachedEvents = KNOWN_LUND_EVENTS;
    return cachedEvents;
  }
}

function parseEventsFromHtml(html: string): LundEvent[] {
  const events: LundEvent[] = [];
  const seen = new Set<string>();

  // Extract text from headings inside typical event/article containers
  const headingRe = /<h[23][^>]*>\s*([^<]{3,80})\s*<\/h[23]>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(html)) !== null) {
    const raw = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, '')
      .trim();

    const key = raw.toLowerCase();
    if (raw && !seen.has(key) && raw.length > 2 && raw.length < 80) {
      seen.add(key);
      events.push({
        id: key.replace(/\s+/g, '-').replace(/[^a-zåäö0-9-]/g, ''),
        name: raw,
        category: 'other',
      });
    }
  }

  return events.slice(0, 60);
}
