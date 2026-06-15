import { EventCategory, EVENT_CATEGORIES, CATEGORY_SUB_EVENTS, getEventCategory } from '@/lib/mockData';
import { Listing } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

interface CategoryTabsProps {
  active: EventCategory;
  onChange: (cat: EventCategory) => void;
  listings: Listing[];
  eventFilter: string;
  onEventFilterChange: (event: string) => void;
  /** Compact mode: smaller pills, no count chips, used inline next to search bar. */
  compact?: boolean;
}

export default function CategoryTabs({
  active, onChange, listings, eventFilter, onEventFilterChange, compact = false,
}: CategoryTabsProps) {
  const { lang } = useI18n();

  const counts = listings.reduce<Record<EventCategory, number>>((acc, l) => {
    if (l.isSold) return acc;
    const cat = getEventCategory(l);
    acc[cat] = (acc[cat] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, { all: 0, valborg: 0, karneval: 0, forkop: 0, other: 0 });

  const subEvents = CATEGORY_SUB_EVENTS[active] || [];

  const pillSize = compact
    ? 'px-3 py-1.5 text-xs'
    : 'px-4 py-2 text-sm';

  return (
    <div className="space-y-2">
      <div className="gap-1 overflow-x-auto scrollbar-none pb-2 flex-row flex items-center justify-start">
        {EVENT_CATEGORIES.map(cat => {
          const isActive = active === cat.id;
          const label = lang === 'sv' ? cat.sv : cat.en;
          const count = counts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => { onChange(cat.id); onEventFilterChange(''); }}
              className={`shrink-0 ${pillSize} rounded-lg font-medium transition-all ${
                isActive
                  ? 'border border-[#e39e72]/45 bg-[#ffc8a5] text-foreground shadow-sm dark:border-[#e39e72]/55 dark:bg-[#e39e72] dark:text-white'
                  : 'border border-border bg-card text-muted-foreground hover:border-[#e39e72]/28 hover:bg-[#ffc8a5]/20 hover:text-foreground'
              }`}
            >
              {label}
              {!compact && (
                <span className={`ml-1.5 text-xs ${isActive ? 'text-foreground/65 dark:text-white/75' : 'text-muted-foreground/60'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {subEvents.length > 0 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-2">
          <button
            onClick={() => onEventFilterChange('')}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              !eventFilter
                ? 'border border-[#e39e72]/35 bg-[#ffc8a5]/75 text-foreground dark:border-[#e39e72]/45 dark:bg-[#e39e72] dark:text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-[#ffc8a5]/25'
            }`}
          >
            Alla
          </button>
          {subEvents.map(ev => (
            <button
              key={ev}
              onClick={() => onEventFilterChange(eventFilter === ev ? '' : ev)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                eventFilter === ev
                  ? 'border border-[#e39e72]/35 bg-[#ffc8a5]/75 text-foreground dark:border-[#e39e72]/45 dark:bg-[#e39e72] dark:text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#ffc8a5]/25'
              }`}
            >
              {ev}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
