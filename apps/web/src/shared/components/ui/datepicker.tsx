import { useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/shared/utils/cn';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD). */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** App-styled calendar date picker (replaces the native date input). */
export function DatePicker({ value, onChange, placeholder, className }: DatePickerProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? enUS : es;
  const selected = value ? parseISO(value) : null;
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  // Open the popup aligned to whichever side keeps it on screen (the calendar is
  // wider than half the row, so a right-hand field would otherwise overflow and
  // make the page scroll horizontally).
  const toggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const POPUP_W = 288; // w-72
      setAlignRight(rect.left + POPUP_W > window.innerWidth - 8);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(view), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(view), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [view]);

  const today = new Date();

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-road-300 bg-white px-3 py-2 text-left text-base hover:border-road-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className={cn('truncate', !selected && 'text-road-400')}>
          {selected ? format(selected, 'd MMM yyyy', { locale }) : (placeholder ?? '—')}
        </span>
        <AppIcons.calendar size={18} className="shrink-0 text-road-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
          <div
            className={cn(
              'absolute z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-road-200 bg-white p-3 shadow-xl',
              alignRight ? 'right-0' : 'left-0',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView((v) => addMonths(v, -1))}
                className="rounded-lg p-1.5 hover:bg-road-100"
                aria-label="<"
              >
                <AppIcons.chevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold capitalize">
                {format(view, 'MMMM yyyy', { locale })}
              </span>
              <button
                type="button"
                onClick={() => setView((v) => addMonths(v, 1))}
                className="rounded-lg p-1.5 hover:bg-road-100"
                aria-label=">"
              >
                <AppIcons.chevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-road-400">
              {days.slice(0, 7).map((d) => (
                <span key={d.toISOString()} className="py-1 capitalize">
                  {format(d, 'EEEEE', { locale })}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((d) => {
                const inMonth = isSameMonth(d, view);
                const isSel = selected && isSameDay(d, selected);
                const isTod = isSameDay(d, today);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(format(d, 'yyyy-MM-dd'));
                      setOpen(false);
                    }}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg text-sm',
                      !inMonth && 'text-road-300',
                      isSel
                        ? 'bg-brand-500 font-bold text-white'
                        : 'hover:bg-road-100',
                      !isSel && isTod && 'font-bold text-brand-600',
                    )}
                  >
                    {format(d, 'd')}
                  </button>
                );
              })}
            </div>

            {selected && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="mt-2 w-full text-center text-xs text-road-500 underline"
              >
                {t('Limpiar')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
