import * as React from 'react';
import { cn } from '@/shared/utils/cn';
import { AppIcons } from '@/shared/constants/icons';

interface Opt {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  children?: React.ReactNode;
}

/** Pull {value,label} out of native <option> children so callers keep the same API. */
function extractOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === 'option') {
      const p = child.props as {
        value?: string | number;
        children?: React.ReactNode;
        disabled?: boolean;
      };
      out.push({
        value: String(p.value ?? ''),
        label: typeof p.children === 'string' ? p.children : String(p.children ?? p.value ?? ''),
        disabled: p.disabled,
      });
    }
  });
  return out;
}

/**
 * Custom, app-styled dropdown. Drop-in replacement for a native <select>:
 * still accepts <option> children and fires onChange with { target: { value } }.
 * Becomes searchable automatically when there are many options.
 */
export function Select({
  value,
  onChange,
  className,
  disabled,
  id,
  placeholder,
  children,
}: SelectProps) {
  const options = React.useMemo(() => extractOptions(children), [children]);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const current = String(value ?? '');
  const selected = options.find((o) => o.value === current);
  const searchable = options.length > 7;
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (v: string) => {
    onChange?.({ target: { value: v } });
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-road-300 bg-white px-3 py-2 text-left text-base transition-colors hover:border-road-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !selected && 'text-road-400')}>
          {selected?.label ?? placeholder ?? 'Seleccionar'}
        </span>
        <AppIcons.chevronDown
          size={18}
          className={cn('shrink-0 text-road-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-road-200 bg-white shadow-xl">
            {searchable && (
              <div className="border-b border-road-100 p-2">
                <div className="flex items-center gap-2 rounded-lg bg-road-50 px-2">
                  <AppIcons.search size={16} className="shrink-0 text-road-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar…"
                    className="h-9 w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-road-400">Sin resultados</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={o.disabled}
                    onClick={() => pick(o.value)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-road-50 disabled:opacity-40',
                      o.value === current && 'bg-brand-50 font-semibold text-brand-700',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === current && (
                      <AppIcons.check size={16} className="shrink-0 text-brand-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
Select.displayName = 'Select';
