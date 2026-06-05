import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
}

function cellValue<T>(column: Column<T>, row: T): ReactNode {
  return column.render
    ? column.render(row)
    : String((row as Record<string, unknown>)[column.key] ?? '');
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty = 'Sin registros',
}: DataTableProps<T>) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-road-200 bg-white px-4 py-10 text-center text-road-400">
        {t(empty)}
      </div>
    );
  }

  // Header-less columns (e.g. actions) render in the card footer on mobile.
  const labelled = columns.filter((c) => c.header.trim() !== '');
  const actions = columns.filter((c) => c.header.trim() === '');

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-road-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-road-200 bg-road-50 text-left text-xs uppercase tracking-wide text-road-500">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-4 py-3 font-semibold', c.className)}>
                  {t(c.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-road-100 last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-road-50',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3', c.className)}>
                    {cellValue(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'rounded-xl border border-road-200 bg-white p-3',
              onRowClick && 'active:bg-road-50',
            )}
          >
            <div className="space-y-1.5">
              {labelled.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="shrink-0 text-xs uppercase tracking-wide text-road-400">
                    {t(c.header)}
                  </span>
                  <span className="min-w-0 truncate text-right font-medium text-road-900">
                    {cellValue(c, row)}
                  </span>
                </div>
              ))}
            </div>
            {actions.length > 0 && (
              <div className="mt-2 flex justify-end gap-2 border-t border-road-100 pt-2">
                {actions.map((c) => (
                  <span key={c.key}>{cellValue(c, row)}</span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
