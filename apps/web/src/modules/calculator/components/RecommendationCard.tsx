import type { TripStatus } from '@shared/financial-model/profitability';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useI18n } from '@/core/i18n/i18n';

const messages: Record<TripStatus, { text: string; icon: string }> = {
  profitable: {
    icon: '✅',
    text: 'Viaje rentable. Puedes aceptar.',
  },
  acceptable: {
    icon: '🤝',
    text: 'Margen bajo. Negocia o acepta si necesitas.',
  },
  not_profitable: {
    icon: '❌',
    text: 'Viaje no rentable. Rechaza o contraoferta.',
  },
};

export function RecommendationCard({ status }: { status: TripStatus }) {
  const { t } = useI18n();
  const m = messages[status];
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <span className="text-2xl">{m.icon}</span>
        <p className="text-sm font-medium text-road-800">{t(m.text)}</p>
      </CardContent>
    </Card>
  );
}
