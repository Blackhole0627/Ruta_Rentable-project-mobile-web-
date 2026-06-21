import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  emptyMessage?: string;
  searchable?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  label,
  emptyMessage = 'Sin resultados',
  searchable = true,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const toggle = () => {
    setOpen((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  };

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-road-800">{label}</label>
      )}

      <div
        ref={rootRef}
        className={cn(
          'overflow-hidden rounded-xl border bg-white transition-shadow',
          open
            ? 'border-brand-400 shadow-card-lg ring-4 ring-brand-500/15'
            : 'border-road-200 shadow-sm hover:border-road-300',
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 px-3 text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
          )}
        >
          <span className={cn('truncate text-base', !selected && 'text-road-400')}>
            {selected ? selected.label : placeholder}
          </span>
          <AppIcons.chevronDown
            {...iconPropsSm}
            className={cn(
              'shrink-0 text-road-500 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <div className="border-t border-road-100">
            {searchable && options.length > 6 && (
              <div className="flex items-center gap-2 border-b border-road-100 bg-road-50/80 px-3 py-2">
                <AppIcons.search {...iconPropsSm} className="shrink-0 text-road-400" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-road-400"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <ul
              role="listbox"
              className="max-h-52 overflow-y-auto overscroll-contain py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-5 text-center text-sm text-road-500">{emptyMessage}</li>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <li key={opt.value} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          'flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-road-800 hover:bg-road-50 active:bg-road-100',
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span
                            className={cn('truncate text-base', isSelected ? 'font-semibold' : 'font-normal')}
                          >
                            {opt.label}
                          </span>
                          {opt.description && (
                            <span
                              className={cn(
                                'mt-0.5 text-xs',
                                isSelected ? 'text-brand-600/80' : 'text-road-500',
                              )}
                            >
                              {opt.description}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <AppIcons.check {...iconPropsSm} className="mt-0.5 shrink-0 text-brand-600" />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
