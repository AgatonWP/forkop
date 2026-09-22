/** Nations and LTH sections sell different kinds of tickets; see ticketTypesFor. */
export type OrganizerKind = 'nation' | 'section';

export interface Nation {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  color: string;
  kind?: OrganizerKind;
  /**
   * A real organizer, but one so seldom needed that it waits in search rather
   * than taking up a row in every list. It shows up as soon as someone types
   * its name, and stays visible wherever it is already the one chosen.
   */
  searchOnly?: boolean;
  /** A place rather than an organizer: offered under "Var?" in Borttappat only. */
  placeOnly?: boolean;
}

export const NATIONS_LIST: Nation[] = [
  { id: 'helsingkrona', name: 'Helsingkrona Nation', shortName: 'HK', aliases: ['hk', 'helsingkrona', 'helsingkrona nation'], color: '#E53E3E', kind: 'nation' },
  { id: 'goteborgs', name: 'Göteborgs Nation', shortName: 'GBG', aliases: ['gbg', 'goteborg', 'göteborg', 'goteborgs', 'göteborgs'], color: '#3B82F6', kind: 'nation' },
  { id: 'lunds', name: 'Lunds Nation', shortName: 'LU', aliases: ['ln', 'lu', 'lund', 'lunds'], color: '#22C55E', kind: 'nation' },
  { id: 'malmo', name: 'Malmö Nation', shortName: 'MN', aliases: ['mn', 'malmo', 'malmö', 'casa'], color: '#D97706', kind: 'nation' },
  { id: 'ostgota', name: 'Östgöta Nation', shortName: 'ÖG', aliases: ['og', 'ög', 'ostgota', 'östgöta', 'ostgota nation'], color: '#7C3AED', kind: 'nation' },
  { id: 'sydskanska', name: 'Sydskånska Nation', shortName: 'SS', aliases: ['ss', 'sydskanska', 'sydskånska', 'syd'], color: '#0284C7', kind: 'nation' },
  { id: 'vg', name: 'Västgöta Nation', shortName: 'VG', aliases: ['vg', 'vastgota', 'västgöta', 'vastgota nation'], color: '#DB2777', kind: 'nation' },
  { id: 'blekingska', name: 'Blekingska Nation', shortName: 'BL', aliases: ['bl', 'bn', 'blekinge', 'blekingska'], color: '#0D9488', kind: 'nation' },
  { id: 'kristianstad', name: 'Kristianstads Nation', shortName: 'KR', aliases: ['kr', 'kn', 'kristianstad', 'krischan', 'krischanstad'], color: '#EA580C', kind: 'nation' },
  { id: 'hallands', name: 'Hallands Nation', shortName: 'HL', aliases: ['hl', 'hn', 'halland', 'hallands'], color: '#2563EB', kind: 'nation' },
  { id: 'kalmar', name: 'Kalmar Nation', shortName: 'KA', aliases: ['ka', 'kn', 'kalmar'], color: '#B45309', kind: 'nation' },
  { id: 'wermlands', name: 'Wermlands Nation', shortName: 'WN', aliases: ['wn', 'wermlands', 'värmlands', 'varmlands', 'wermland'], color: '#1D4ED8', kind: 'nation' },
  { id: 'smalands', name: 'Smålands Nation', shortName: 'SM', aliases: ['sm', 'sn', 'smalands', 'smålands'], color: '#15803D', kind: 'nation' },
  // Karnevalen comes round every four years, so it is searchable rather than listed.
  { id: 'karneval', name: 'Lundakarnevalen', shortName: 'LK', aliases: ['lk', 'karneval', 'lundakarnevalen'], color: '#DC2626', searchOnly: true },
  { id: 'afborgen', name: 'AF-borgen', shortName: 'AF', aliases: ['af', 'afb', 'af borgen', 'af-borgen', 'borgen', 'tbar', 't-bar', 'tibban'], color: '#C2410C' },
  { id: 'mejeriet', name: 'Mejeriet', shortName: 'MJ', aliases: ['mj', 'mejeri', 'mejeriet'], color: '#6D28D9' },
  { id: 'stadsparken', name: 'Stadsparken', shortName: 'SP', aliases: ['sp', 'stadsparken', 'stadspark'], color: '#16A34A' },
  // The hall in Kårhuset at LTH where the sections hold their eftersläpp.
  { id: 'gasquesalen', name: 'Gasquesalen', shortName: 'GQ', aliases: ['gq', 'gasque', 'gasquen', 'gasquesalen', 'kårhuset', 'karhuset'], color: '#475569', placeOnly: true },
  // LTH:s kårsektioner (TLTH)
  { id: 'f-sektionen', name: 'F-sektionen', shortName: 'F', aliases: ['f', 'f-sektionen', 'teknisk fysik', 'teknisk matematik', 'teknisk nanovetenskap', 'fysik'], color: '#F59E0B', kind: 'section' },
  { id: 'e-sektionen', name: 'E-sektionen', shortName: 'E', aliases: ['e', 'e-sektionen', 'elektroteknik', 'medicin och teknik'], color: '#059669', kind: 'section' },
  { id: 'maskinsektionen', name: 'Maskinsektionen', shortName: 'M', aliases: ['m', 'maskin', 'maskinsektionen', 'maskinteknik'], color: '#EF4444', kind: 'section' },
  { id: 'v-sektionen', name: 'V-sektionen', shortName: 'V', aliases: ['v', 'v-sektionen', 'väg- och vattenbyggnad', 'vag- och vattenbyggnad', 'lantmäteri', 'lantmateri', 'brandingenjör', 'brandingenjor', 'riskhantering'], color: '#0EA5E9', kind: 'section' },
  { id: 'a-sektionen', name: 'A-sektionen', shortName: 'A', aliases: ['a', 'a-sektionen', 'arkitektur', 'industridesign'], color: '#EC4899', kind: 'section' },
  { id: 'k-sektionen', name: 'K-sektionen', shortName: 'K', aliases: ['k', 'k-sektionen', 'kemiteknik', 'bioteknik', 'livsmedelsteknik'], color: '#14B8A6', kind: 'section' },
  { id: 'd-sektionen', name: 'D-sektionen', shortName: 'D', aliases: ['d', 'd-sektionen', 'datateknik', 'informations- och kommunikationsteknik', 'ikt'], color: '#6366F1', kind: 'section' },
  { id: 'dokt-sektionen', name: 'Dokt-sektionen', shortName: 'Dokt', aliases: ['dokt', 'dokt-sektionen', 'doktorander'], color: '#78716C', kind: 'section' },
  { id: 'ingenjorssektionen', name: 'Ingenjörssektionen', shortName: 'Ing', aliases: ['ing', 'ingenjörssektionen', 'ingenjorssektionen', 'högskoleingenjör', 'hogskoleingenjor', 'basår', 'basar'], color: '#A855F7', kind: 'section' },
  { id: 'w-sektionen', name: 'W-sektionen', shortName: 'W', aliases: ['w', 'w-sektionen', 'ekosystemteknik', 'risk säkerhet och krishantering'], color: '#84CC16', kind: 'section' },
  { id: 'i-sektionen', name: 'I-sektionen', shortName: 'I', aliases: ['i', 'i-sektionen', 'industriell ekonomi'], color: '#F97316', kind: 'section' },
  { id: 'other', name: 'Annat', shortName: '??', aliases: ['annat', 'annan', 'other', 'ovrigt', 'övrigt'], color: '#6B7280' },
];

/** Who can be behind a ticket: everyone but the bare places. */
export const ORGANIZERS = NATIONS_LIST.filter((nation) => !nation.placeOnly);

/**
 * Where something can go missing: everyone but the sections, which are student
 * bodies rather than places. Their eftersläpp are at Gasquesalen, which is
 * listed for that reason.
 */
export const PLACES = NATIONS_LIST.filter((nation) => nation.kind !== 'section');

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

/**
 * Whether a picker lists this organizer before anything is typed. Search-only
 * organizers wait for a search, unless already the one selected. Leaving one
 * out altogether — as Lundakarnevalen once was — pushed its sellers to type it
 * under "Annat" and lose both the organizer filter and its own ticket types.
 */
export function listedWithoutSearch(option: { id: string; searchOnly?: boolean }, selectedId: string | null) {
  return !option.searchOnly || option.id === selectedId;
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
