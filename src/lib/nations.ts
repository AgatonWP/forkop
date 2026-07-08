export interface Nation {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  color: string;
}

export const NATIONS_LIST: Nation[] = [
  { id: 'helsingkrona', name: 'Helsingkrona Nation', shortName: 'HK', aliases: ['hk', 'helsingkrona', 'helsingkrona nation'], color: '#E53E3E' },
  { id: 'goteborgs', name: 'Göteborgs Nation', shortName: 'GBG', aliases: ['gbg', 'goteborg', 'göteborg', 'goteborgs', 'göteborgs'], color: '#3B82F6' },
  { id: 'lunds', name: 'Lunds Nation', shortName: 'LU', aliases: ['ln', 'lu', 'lund', 'lunds'], color: '#22C55E' },
  { id: 'malmo', name: 'Malmö Nation', shortName: 'MN', aliases: ['mn', 'malmo', 'malmö', 'casa'], color: '#D97706' },
  { id: 'ostgota', name: 'Östgöta Nation', shortName: 'ÖG', aliases: ['og', 'ög', 'ostgota', 'östgöta', 'ostgota nation'], color: '#7C3AED' },
  { id: 'sydskanska', name: 'Sydskånska Nation', shortName: 'SS', aliases: ['ss', 'sydskanska', 'sydskånska', 'syd'], color: '#0284C7' },
  { id: 'vg', name: 'Västgöta Nation', shortName: 'VG', aliases: ['vg', 'vastgota', 'västgöta', 'vastgota nation'], color: '#DB2777' },
  { id: 'blekingska', name: 'Blekingska Nation', shortName: 'BL', aliases: ['bl', 'bn', 'blekinge', 'blekingska'], color: '#0D9488' },
  { id: 'kristianstad', name: 'Kristianstads Nation', shortName: 'KR', aliases: ['kr', 'kn', 'kristianstad', 'krischan', 'krischanstad'], color: '#EA580C' },
  { id: 'hallands', name: 'Hallands Nation', shortName: 'HL', aliases: ['hl', 'hn', 'halland', 'hallands'], color: '#2563EB' },
  { id: 'kalmar', name: 'Kalmar Nation', shortName: 'KA', aliases: ['ka', 'kn', 'kalmar'], color: '#B45309' },
  { id: 'wermlands', name: 'Wermlands Nation', shortName: 'WN', aliases: ['wn', 'wermlands', 'värmlands', 'varmlands', 'wermland'], color: '#1D4ED8' },
  { id: 'smalands', name: 'Smålands Nation', shortName: 'SM', aliases: ['sm', 'sn', 'smalands', 'smålands'], color: '#15803D' },
  { id: 'karneval', name: 'Lundakarnevalen', shortName: 'LK', aliases: ['lk', 'karneval', 'lundakarnevalen'], color: '#DC2626' },
  { id: 'afborgen', name: 'AF-borgen', shortName: 'AF', aliases: ['af', 'afb', 'af borgen', 'af-borgen', 'borgen', 'tbar', 't-bar', 'tibban'], color: '#C2410C' },
  { id: 'mejeriet', name: 'Mejeriet', shortName: 'MJ', aliases: ['mj', 'mejeri', 'mejeriet'], color: '#6D28D9' },
  { id: 'stadsparken', name: 'Stadsparken', shortName: 'SP', aliases: ['sp', 'stadsparken', 'stadspark'], color: '#16A34A' },
  { id: 'other', name: 'Annat', shortName: '??', aliases: ['annat', 'annan', 'other', 'ovrigt', 'övrigt'], color: '#6B7280' },
];

export function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getNationSearchText(nation: Nation) {
  return normalizeSearchText([nation.id, nation.name, nation.shortName, ...nation.aliases].join(' '));
}

export function nationMatchesQuery(nation: Nation, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  return !normalizedQuery || getNationSearchText(nation).includes(normalizedQuery);
}

export function getNation(id: string): Nation {
  return NATIONS_LIST.find(n => n.id === id) ?? {
    id,
    name: id,
    shortName: id.slice(0, 2).toUpperCase(),
    aliases: [],
    color: '#6B7280',
  };
}
