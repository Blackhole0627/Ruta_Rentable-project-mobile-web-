import type { CostBreakdown } from '@/core/financial-model/costPerKm';
import type { Currency } from '@shared/types/user.types';
import { formatCurrency } from '@/shared/utils/currency';

interface Props {
  breakdown: CostBreakdown;
  currency: Currency;
}

const COMPONENTS: { key: keyof CostBreakdown; label: string; color: string }[] = [
  { key: 'fuelPerKm', label: 'Combustible', color: '#10b981' },
  { key: 'tiresPerKm', label: 'Llantas', color: '#059669' },
  { key: 'oilPerKm', label: 'Aceite', color: '#f4b740' },
  { key: 'maintenancePerKm', label: 'Mantenimiento', color: '#f59e0b' },
  { key: 'depreciationPerKm', label: 'Depreciación', color: '#f43f5e' },
  { key: 'fixedCostsPerKm', label: 'Costos fijos', color: '#94a3b0' },
];

/** FR-VEH-04 — horizontal stacked bar showing the 6 cost-per-km components. */
export function CostBreakdownChart({ breakdown, currency }: Props) {
  const total = breakdown.totalPerKm || 1;

  return (
    <div className="space-y-2.5">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-road-100 ring-1 ring-inset ring-road-100">
        {COMPONENTS.map((c) => {
          const value = breakdown[c.key];
          const pct = (value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={c.key}
              className="transition-all"
              style={{ width: `${pct}%`, backgroundColor: c.color }}
              title={`${c.label}: ${formatCurrency(value, currency)}/km`}
            />
          );
        })}
      </div>
      <ul className="grid grid-cols-2 gap-x-2.5 gap-y-1.5">
        {COMPONENTS.map((c) => {
          const value = breakdown[c.key];
          const pct = (value / total) * 100;
          return (
            <li key={c.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-road-500">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-inset ring-white/40"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </span>
              <span className="tabular font-semibold text-road-900">
                {formatCurrency(value, currency)}
                <span className="ml-1 font-medium text-road-400">{pct.toFixed(0)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
