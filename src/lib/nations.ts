export interface Nation {
  id: string;
  name: string;
  shortName: string;
  color: string;
}

export const NATIONS_LIST: Nation[] = [
  { id: 'helsingkrona', name: 'Helsingkrona Nation', shortName: 'HK', color: '#E53E3E' },
  { id: 'goteborgs', name: 'Göteborgs Nation', shortName: 'GBG', color: '#3B82F6' },
  { id: 'lunds', name: 'Lunds Nation', shortName: 'LU', color: '#22C55E' },
  { id: 'malmo', name: 'Malmö Nation', shortName: 'MN', color: '#D97706' },
  { id: 'ostgota', name: 'Östgöta Nation', shortName: 'ÖG', color: '#7C3AED' },
  { id: 'sydskanska', name: 'Sydskånska Nation', shortName: 'SS', color: '#0284C7' },
  { id: 'vg', name: 'Västgöta Nation', shortName: 'VG', color: '#DB2777' },
  { id: 'blekingska', name: 'Blekingska Nation', shortName: 'BL', color: '#0D9488' },
  { id: 'kristianstad', name: 'Kristianstads Nation', shortName: 'KR', color: '#EA580C' },
  { id: 'hallands', name: 'Hallands Nation', shortName: 'HL', color: '#2563EB' },
  { id: 'kalmar', name: 'Kalmar Nation', shortName: 'KA', color: '#B45309' },
  { id: 'wermlands', name: 'Wermlands Nation', shortName: 'WN', color: '#1D4ED8' },
  { id: 'smalands', name: 'Smålands Nation', shortName: 'SM', color: '#15803D' },
  { id: 'karneval', name: 'Lundakarnevalen', shortName: 'LK', color: '#DC2626' },
  { id: 'tbar', name: 'T-Bar', shortName: 'TB', color: '#C2410C' },
  { id: 'mejeriet', name: 'Mejeriet', shortName: 'MJ', color: '#6D28D9' },
  { id: 'stadsparken', name: 'Stadsparken', shortName: 'SP', color: '#16A34A' },
  { id: 'other', name: 'Annat', shortName: '??', color: '#6B7280' },
];

export function getNation(id: string): Nation {
  return NATIONS_LIST.find(n => n.id === id) ?? { id, name: id, shortName: id.slice(0, 2).toUpperCase(), color: '#6B7280' };
}
