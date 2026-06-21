import { useState } from 'react';
import type { TripResult } from '@/core/financial-model/tripCalculator';
import { TrafficLight } from './TrafficLight';
import { RecommendationCard } from './RecommendationCard';
import { MinimumFareBadge } from './MinimumFareBadge';
import { formatCurrency } from '@/shared/utils/currency';
import { formatPercent } from '@/shared/utils/formatters';
import type { Currency } from '@shared/types/user.types';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

interface ProfitabilityResultProps {
  result: TripResult;
  currency: Currency;
}

export function ProfitabilityResult({ result, currency }: ProfitabilityResultProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const costs = [
    { label: 'Combustible', value: result.fuelCost },
    { label: 'Llantas', value: result.tireCost },
    { label: 'Aceite', value: result.oilCost },
    { label: 'Mantenimiento', value: result.maintenanceCost },
    { label: 'Depreciación', value: result.depreciationCost },
    { label: 'Costos fijos', value: result.fixedCost },
    { label: 'Comisión', value: result.commission },
  ];

  return (
    <div className="space-y-2.5">
      <TrafficLight status={result.status} />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white p-3 text-center shadow-card ring-1 ring-road-100">
          <p className="text-xs font-medium text-road-500">{t('Ganancia neta')}</p>
          <p
            className={`tabular mt-0.5 text-xl font-extrabold tracking-tight ${result.netProfit >= 0 ? 'text-brand-600' : 'text-danger-500'}`}
          >
            {formatCurrency(result.netProfit, currency)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-card ring-1 ring-road-100">
          <p className="text-xs font-medium text-road-500">{t('Margen')}</p>
          <p className="tabular mt-0.5 text-xl font-extrabold tracking-tight text-road-900">
            {formatPercent(result.margin)}
          </p>
        </div>
      </div>
      <MinimumFareBadge minimumFare={result.minimumFare} currency={currency} />
      <RecommendationCard status={result.status} />
      <button
        type="button"
        className="press flex w-full items-center justify-between rounded-2xl border border-road-100 bg-white px-3.5 py-2.5 text-sm font-semibold text-road-700 shadow-card"
        onClick={() => setExpanded(!expanded)}
      >
        {t('Desglose de costos')}
        {expanded ? (
          <AppIcons.chevronUp {...iconPropsSm} className="text-road-400" />
        ) : (
          <AppIcons.chevronDown {...iconPropsSm} className="text-road-400" />
        )}
      </button>
      {expanded && (
        <div className="animate-slide-up-in space-y-2 rounded-2xl bg-white p-3 text-sm shadow-card ring-1 ring-road-100">
          {costs.map((c) => (
            <div key={c.label} className="flex justify-between">
              <span className="text-road-500">{t(c.label)}</span>
              <span className="tabular font-medium text-road-800">
                {formatCurrency(c.value, currency)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-road-100 pt-2.5 font-bold text-road-900">
            <span>{t('Costo total')}</span>
            <span className="tabular">{formatCurrency(result.totalTripCost, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
