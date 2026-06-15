import { useMemo, useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { getEventOptions } from '@/lib/eventOptions';

interface EventComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectEvent?: (eventName: string, nationName: string) => void;
  placeholder?: string;
}

/**
 * Compact event-name autocomplete. Suggests events from the catalog as the
 * user types but always allows free-text input (for non-catalog events).
 */
export default function EventCombobox({ value, onChange, onSelectEvent, placeholder }: EventComboboxProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const allEvents = useMemo(() => getEventOptions(), []);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return allEvents.slice(0, 6);
    return allEvents
      .filter(e => e.label.toLowerCase().includes(q) || e.nationName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, allEvents]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePick = (label: string, nationName: string) => {
    onChange(label);
    onSelectEvent?.(label, nationName);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-7"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
      {open && matches.length > 0 && (
        <div
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto overscroll-contain rounded-md border border-border bg-popover shadow-lg touch-pan-y"
          onWheel={(e) => e.stopPropagation()}
        >
          {matches.map(ev => (
            <button
              key={ev.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(ev.label, ev.nationName)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center"
            >
              <span className="font-medium truncate">{ev.label}</span>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">{ev.nationName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
