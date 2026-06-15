import { Listing } from './types';

export type EventCategory = 'all' | 'valborg' | 'karneval' | 'forkop' | 'other';

export const EVENT_CATEGORIES: { id: EventCategory; sv: string; en: string; keywords: string[] }[] = [
  { id: 'all', sv: 'Alla', en: 'All', keywords: [] },
  { id: 'valborg', sv: 'Valborg', en: 'Valborg', keywords: ['valborg', 'näst siste april', '1 maj', 'sunwing', 'first of may', 'yran', 'skvalborg', 'kvalborg', 'tegelbruket', 'siste april', 'stadsparken', 't-bar'] },
  { id: 'karneval', sv: 'Karneval', en: 'Carnival', keywords: ['lundakarnevalen', 'karneval', 'karnevalen', 'grandevalen', 'zodiacalkarneval', 'zodiacal', 'tropical karneval', 'tropicalkarneval', 'spexet', 'revyn', 'kabarén', 'showen', 'cirkusen', 'filmen', 'dubbelkvarten', 'barnevalen', 'dansen', 'sunrise', 'downtown', 'silent disco', 'slabbet', 'sunset x zodiacclub', 'beergarden', 'karnevalsklubb', 'nostradamus', 'cabaret grotesque', 'cirkus van vágoo', 'se upp'] },
  { id: 'forkop', sv: 'Förköp', en: 'Presale', keywords: ['förköp', 'presale', 'early bird', 'förhandsbiljett'] },
  { id: 'other', sv: 'Övrigt', en: 'Other', keywords: [] },
];

export const CATEGORY_SUB_EVENTS: Record<EventCategory, string[]> = {
  all: [],
  valborg: ['Sunwing', 'Yran', 'Näst Siste April', 'Siste April', 'Skvalborg', 'Kvalborg', 'Tegelbruket', 'T-Bar'],
  karneval: ['Lundakarnevalen', 'Grandevalen', 'Zodiacalkarnevalen', 'Tropical Karneval', 'Spexet', 'Revyn', 'Kabarén', 'Showen', 'Cirkusen', 'Filmen', 'Dubbelkvarten', 'Barnevalen', 'DANSEN', 'Sunrise', 'Downtown', 'Silent Disco', 'Slabbet', 'Sunset x Zodiacclub', 'Beergarden'],
  forkop: [],
  other: [],
};

export function getEventCategory(listing: Listing): EventCategory {
  const name = listing.eventName.toLowerCase();
  for (const cat of EVENT_CATEGORIES) {
    if (cat.id === 'all' || cat.id === 'other') continue;
    if (cat.keywords.some(kw => name.includes(kw))) return cat.id;
  }
  return 'other';
}

export const POPULAR_EVENTS = [
  'Valborg', 'Yran', 'Sunwing', 'Näst Siste April', 'AF-Borgen',
  'Lundakarnevalen', 'Grandevalen', 'Zodiacalkarnevalen', 'Tropical Karneval', 'Spexet', 'Revyn', 'Kabarén', 'Showen',
  'Cirkusen', 'Filmen', 'Dubbelkvarten', 'Barnevalen',
  'Tandem', 'Sångarstriden', 'Nollning',
  'VG Gala', 'Malmöfestivalen', 'Nation Sittning', '1 Maj',
];

export const mockListings: Listing[] = [
  {
    id: '1',
    eventName: '1 Maj',
    ticketType: 'Entry',
    quantity: 2,
    dealType: 'sell',
    price: 250,
    description: 'Two tickets for Valborg celebrations at AF-Borgen. Can meet up in Lund city center.',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/erik',
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    isHot: true,
    nationId: 'goteborgs',
  },
  {
    id: '2',
    eventName: 'Sunwing',
    ticketType: 'VIP',
    quantity: 1,
    dealType: 'trade',
    tradeDescription: '2 Valborg-inträden',
    description: 'Looking to trade my Sunwing VIP for Valborg tickets. DM me!',
    contactMethod: 'Phone',
    contactInfo: '070-123-4567',
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    nationId: 'helsingkrona',
  },
  {
    id: '3',
    eventName: 'Yran',
    ticketType: 'Weekend Pass',
    quantity: 3,
    dealType: 'sell',
    price: 800,
    description: 'Selling 3 weekend passes for Yran. Price per ticket. Negotiable if you buy all three!',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/anna',
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    isHot: true,
    nationId: 'malmo',
  },
  {
    id: '4',
    eventName: 'Lundakarnevalen',
    ticketType: 'Entry',
    quantity: 1,
    dealType: 'both',
    price: 150,
    tradeDescription: 'Nationssittning',
    description: 'One Lundakarneval ticket, can sell or trade. Open to offers.',
    contactMethod: 'Phone',
    contactInfo: '073-456-7890',
    createdAt: new Date(Date.now() - 1000 * 60 * 200),
    nationId: 'karneval',
  },
  {
    id: '5',
    eventName: 'Spexet – Nostradamus',
    ticketType: 'Biljett',
    quantity: 2,
    dealType: 'sell',
    price: 190,
    description: 'Säljer 2 biljetter till Spexet fredag kl 19:30. Heta tider!',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/johan',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    nationId: 'karneval',
  },
  {
    id: '6',
    eventName: 'Nation Sittning',
    ticketType: 'Sittning',
    quantity: 2,
    dealType: 'trade',
    tradeDescription: '1 Yran helgpass',
    description: 'Trading nation sittning tickets. Located near Lundagård.',
    contactMethod: 'Phone',
    contactInfo: '076-789-0123',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    nationId: 'vg',
  },
  {
    id: '7',
    eventName: 'Näst Siste April',
    ticketType: 'Entry',
    quantity: 2,
    dealType: 'sell',
    price: 300,
    description: 'Selling two tickets for Näst Siste April at Lunds Nation.',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/lisa',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    nationId: 'lunds',
  },
  {
    id: '8',
    eventName: 'Showen',
    ticketType: 'Biljett + Barplats',
    quantity: 2,
    dealType: 'sell',
    price: 270,
    description: 'Säljer 2 Showen-biljetter lördag kl 20:00. Barplats.',
    contactMethod: 'Phone',
    contactInfo: '072-555-1234',
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    nationId: 'karneval',
  },
];
