export interface Nation {
  id: string;
  name: string;
  shortName: string;
  color: string; // HSL accent color for the emblem placeholder
}

export const NATIONS: Nation[] = [
  { id: 'helsingkrona', name: 'Helsingkrona Nation', shortName: 'HK', color: '0 72% 51%' },
  { id: 'goteborgs', name: 'Göteborgs Nation', shortName: 'GBG', color: '220 70% 50%' },
  { id: 'lunds', name: 'Lunds Nation', shortName: 'LU', color: '142 60% 40%' },
  { id: 'malmo', name: 'Malmö Nation', shortName: 'MN', color: '45 93% 47%' },
  { id: 'ostgota', name: 'Östgöta Nation', shortName: 'ÖG', color: '280 60% 50%' },
  { id: 'sydskanska', name: 'Sydskånska Nation', shortName: 'SS', color: '200 70% 45%' },
  { id: 'vg', name: 'Västgöta Nation', shortName: 'VG', color: '340 65% 47%' },
  { id: 'blekingska', name: 'Blekingska Nation', shortName: 'BL', color: '170 55% 40%' },
  { id: 'kristianstad', name: 'Kristianstads Nation', shortName: 'KR', color: '25 80% 50%' },
  { id: 'hallands', name: 'Hallands Nation', shortName: 'HL', color: '210 60% 45%' },
  { id: 'kalmar', name: 'Kalmar Nation', shortName: 'KA', color: '40 85% 50%' },
  { id: 'wermlands', name: 'Wermlands Nation', shortName: 'WN', color: '215 50% 45%' },
  { id: 'smalands', name: 'Smålands Nation', shortName: 'SM', color: '120 45% 40%' },
  { id: 'karneval', name: 'Lundakarnevalen', shortName: 'LK', color: '0 70% 50%' },
  { id: 'tbar', name: 'T-Bar', shortName: 'TB', color: '15 80% 55%' },
  { id: 'mejeriet', name: 'Mejeriet', shortName: 'MJ', color: '260 40% 50%' },
  { id: 'stadsparken', name: 'Stadsparken', shortName: 'SP', color: '90 50% 40%' },
  { id: 'other', name: 'Other', shortName: '??', color: '220 10% 50%' },
];

export function getNation(id: string): Nation {
  return NATIONS.find(n => n.id === id) || NATIONS[NATIONS.length - 1];
}
