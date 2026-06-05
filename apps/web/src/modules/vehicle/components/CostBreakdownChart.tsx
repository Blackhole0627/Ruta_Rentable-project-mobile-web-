import type { CostBreakdown } from '@/core/financial-model/costPerKm';
import type { Currency } from '@shared/types/user.types';
import { formatCurrency } from '@/shared/utils/currency';

interface Props {
  breakdown: CostBreakdown;
  currency: Currency;
}

const COMPONENTS: { key: keyof CostBreakdown; label: string; color: string }[] = [
  { key: 'fuelPerKm', label: 'Combustible', color: '#22c55e' },
  { key: 'tiresPerKm', label: 'Llantas', color: '#0ea5e9' },
  { key: 'oilPerKm', label: 'Aceite', color: '#f59e0b' },
  { key: 'maintenancePerKm', label: 'Mantenimiento', color: '#8b5cf6' },
  { key: 'depreciationPerKm', label: 'Depreciación', color: '#ef4444' },
  { key: 'fixedCostsPerKm', label: 'Costos fijos', color: '#64748b' },
];

/** FR-VEH-04 — horizontal stacked bar showing the 6 cost-per-km components. */
export function CostBreakdownChart({ breakdown, currency }: Props) {
  const total = breakdown.totalPerKm || 1;

  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-road-100">
        {COMPONENTS.map((c) => {
          const value = breakdown[c.key];
          const pct = (value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={c.key}
              style={{ width: `${pct}%`, backgroundColor: c.color }}
              title={`${c.label}: ${formatCurrency(value, currency)}/km`}
            />
          );
        })}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {COMPONENTS.map((c) => {
          const value = breakdown[c.key];
          const pct = (value / total) * 100;
          return (
            <li key={c.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-road-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </span>
              <span className="font-medium text-road-900">
                {formatCurrency(value, currency)}
                <span className="ml-1 text-road-400">{pct.toFixed(0)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
