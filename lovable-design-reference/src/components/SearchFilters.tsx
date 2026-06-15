import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { POPULAR_EVENTS } from '@/lib/mockData';
import { NATIONS } from '@/lib/nations';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

export type SortOption = 'newest' | 'oldest';
export type DealFilter = 'all' | 'sell' | 'trade';

interface SearchFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  dealFilter: DealFilter;
  onDealFilterChange: (v: DealFilter) => void;
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  /** Multi-select nation/organizer filter. Empty array = all. */
  nationFilter: string[];
  onNationFilterChange: (v: string[]) => void;
}

export default function SearchFilters({
  search, onSearchChange, dealFilter, onDealFilterChange, sortBy, onSortChange,
  nationFilter, onNationFilterChange,
}: SearchFiltersProps) {
  const { t } = useI18n();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = search.length > 0
    ? POPULAR_EVENTS.filter(e => e.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    const handler = () => setShowSuggestions(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const dealOptions: { value: DealFilter; label: string }[] = [
    { value: 'all', label: t('filter.all') },
    { value: 'sell', label: t('filter.buy') },
    { value: 'trade', label: t('filter.trade') },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: t('sort.newest') },
    { value: 'oldest', label: t('sort.oldest') },
  ];

  const formatNationLabel = (name: string) => name.replace(/ Nation$/, '');

  const nationOptions = NATIONS
    .filter(n => n.id !== 'other' && n.id !== 'stadsparken')
    .map(n => ({ value: n.id, label: formatNationLabel(n.name), fullName: n.name }));

  const toggleNation = (id: string) => {
    if (nationFilter.includes(id)) {
      onNationFilterChange(nationFilter.filter(n => n !== id));
    } else {
      onNationFilterChange([...nationFilter, id]);
    }
  };

  const clearNations = () => onNationFilterChange([]);

  const activeCount = (dealFilter !== 'all' ? 1 : 0) + (sortBy !== 'newest' ? 1 : 0) + (nationFilter.length > 0 ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1" onClick={e => e.stopPropagation()}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={t('search.placeholder')}
            className="h-11 border-[#e39e72]/20 bg-card/95 pl-10 pr-9 placeholder:italic"
            value={search}
            onChange={e => { onSearchChange(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  onClick={() => { onSearchChange(s); setShowSuggestions(false); }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant={filtersOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="h-11 shrink-0 gap-1.5 border-[#e39e72]/30 px-3"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ffc8a5] text-[10px] font-bold text-foreground dark:bg-[#e39e72] dark:text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Collapsible filter panel */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {/* Deal type */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Typ
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dealOptions.map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={dealFilter === opt.value ? 'default' : 'outline'}
                    onClick={() => onDealFilterChange(opt.value)}
                    className="h-7 text-xs px-3"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Sortera
              </span>
              <div className="flex flex-wrap gap-1.5">
                {sortOptions.map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={sortBy === opt.value ? 'secondary' : 'ghost'}
                    onClick={() => onSortChange(opt.value)}
                    className="h-7 text-xs px-3"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Nation/organizer (multi-select chips) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('filter.nation')}
                </span>
                {nationFilter.length > 0 && (
                  <button
                    onClick={clearNations}
                    className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    {t('filter.all')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {nationOptions.map(opt => {
                  const active = nationFilter.includes(opt.value);
                  return (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => toggleNation(opt.value)}
                      className="h-7 text-[11px] px-2.5"
                      title={opt.fullName}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
