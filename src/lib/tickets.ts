export type DealType = 'sell' | 'trade' | 'both';
export type EventCategory = 'all' | 'valborg' | 'karneval' | 'forkop' | 'other';

export type Listing = {
  id: string;
  eventName: string;
  ticketType: string;
  quantity: number;
  dealType: DealType;
  price?: number;
  tradeDescription?: string;
  description: string;
  contactMethod: string;
  contactInfo: string;
  createdAt: Date;
  isHot?: boolean;
  isSold?: boolean;
  nationId: string;
  sellerName?: string;
};

export const EVENT_CATEGORIES: { id: EventCategory; label: string; keywords: string[] }[] = [
  { id: 'all', label: 'Alla', keywords: [] },
  {
    id: 'valborg',
    label: 'Valborg',
    keywords: [
      'valborg',
      'näst siste april',
      'siste april',
      'sunwing',
      'yran',
      'skvalborg',
      'kvalborg',
      'tegelbruket',
      't-bar',
      '1 maj',
    ],
  },
  {
    id: 'karneval',
    label: 'Karneval',
    keywords: [
      'lundakarnevalen',
      'karneval',
      'grandevalen',
      'zodiacalkarneval',
      'tropical karneval',
      'spexet',
      'revyn',
      'kabarén',
      'showen',
      'cirkusen',
      'filmen',
      'dubbelkvarten',
      'barnevalen',
      'silent disco',
      'beergarden',
    ],
  },
  { id: 'forkop', label: 'Förköp', keywords: ['förköp', 'presale', 'early bird'] },
  { id: 'other', label: 'Övrigt', keywords: [] },
];

export const NATIONS: Record<string, string> = {
  goteborgs: 'Göteborgs nation',
  helsingkrona: 'Helsingkrona nation',
  malmo: 'Malmö nation',
  lunds: 'Lunds nation',
  karneval: 'Lundakarnevalen',
  vg: 'Västgöta nation',
};

export function getEventCategory(listing: Listing): EventCategory {
  const name = listing.eventName.toLowerCase();

  for (const category of EVENT_CATEGORIES) {
    if (category.id === 'all' || category.id === 'other') continue;
    if (category.keywords.some((keyword) => name.includes(keyword))) {
      return category.id;
    }
  }

  return 'other';
}

export function formatRelativeTime(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));

  if (minutes < 60) return `${minutes} min sedan`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;

  const days = Math.round(hours / 24);
  return `${days} d sedan`;
}

export const mockListings: Listing[] = [
  {
    id: '1',
    eventName: '1 Maj',
    ticketType: 'Inträde',
    quantity: 2,
    dealType: 'sell',
    price: 250,
    description: 'Två biljetter till Valborgsfirande. Kan mötas upp i centrala Lund.',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/erik',
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    isHot: true,
    nationId: 'goteborgs',
    sellerName: 'Erik',
  },
  {
    id: '2',
    eventName: 'Sunwing',
    ticketType: 'VIP',
    quantity: 1,
    dealType: 'trade',
    tradeDescription: '2x Valborg-inträde',
    description: 'Byter gärna min Sunwing VIP mot Valborgbiljetter.',
    contactMethod: 'Telefon',
    contactInfo: '070-123 45 67',
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    nationId: 'helsingkrona',
    sellerName: 'Maja',
  },
  {
    id: '3',
    eventName: 'Yran',
    ticketType: 'Helgpass',
    quantity: 3,
    dealType: 'sell',
    price: 800,
    description: 'Säljer tre helgpass till Yran. Pris per biljett.',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/anna',
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    isHot: true,
    nationId: 'malmo',
    sellerName: 'Anna',
  },
  {
    id: '4',
    eventName: 'Lundakarnevalen',
    ticketType: 'Inträde',
    quantity: 1,
    dealType: 'both',
    price: 150,
    tradeDescription: 'Nationssittning',
    description: 'Kan sälja eller byta. Öppen för förslag.',
    contactMethod: 'Telefon',
    contactInfo: '073-456 78 90',
    createdAt: new Date(Date.now() - 1000 * 60 * 200),
    nationId: 'karneval',
    sellerName: 'Oskar',
  },
  {
    id: '5',
    eventName: 'Spexet - Nostradamus',
    ticketType: 'Biljett',
    quantity: 2,
    dealType: 'sell',
    price: 190,
    description: 'Två biljetter till Spexet fredag 19:30. Barplats.',
    contactMethod: 'Messenger',
    contactInfo: 'facebook.com/johan',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    nationId: 'karneval',
    sellerName: 'Johan',
  },
  {
    id: '6',
    eventName: 'Nation Sittning',
    ticketType: 'Sittning',
    quantity: 2,
    dealType: 'trade',
    tradeDescription: '1x Yran helgpass',
    description: 'Byter två sittningsbiljetter. Finns nära Lundagård.',
    contactMethod: 'Telefon',
    contactInfo: '076-789 01 23',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    nationId: 'vg',
    sellerName: 'Lisa',
  },
];
