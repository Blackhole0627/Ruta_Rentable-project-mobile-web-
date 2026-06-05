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
    <div className="space-y-4">
      <TrafficLight status={result.status} />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-road-500">{t('Ganancia neta')}</p>
          <p
            className={`text-2xl font-bold ${result.netProfit >= 0 ? 'text-brand-600' : 'text-danger-500'}`}
          >
            {formatCurrency(result.netProfit, currency)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-road-500">{t('Margen')}</p>
          <p className="text-2xl font-bold text-road-900">{formatPercent(result.margin)}</p>
        </div>
      </div>
      <MinimumFareBadge minimumFare={result.minimumFare} currency={currency} />
      <RecommendationCard status={result.status} />
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-road-200 bg-white px-4 py-3 text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        {t('Desglose de costos')}
        {expanded ? (
          <AppIcons.chevronUp {...iconPropsSm} />
        ) : (
          <AppIcons.chevronDown {...iconPropsSm} />
        )}
      </button>
      {expanded && (
        <div className="space-y-2 rounded-lg bg-white p-4 text-sm">
          {costs.map((c) => (
            <div key={c.label} className="flex justify-between">
              <span className="text-road-500">{t(c.label)}</span>
              <span>{formatCurrency(c.value, currency)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>{t('Costo total')}</span>
            <span>{formatCurrency(result.totalTripCost, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
