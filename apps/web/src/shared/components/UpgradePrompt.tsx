import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

/** Locked-feature card that points the user to the subscription page. */
export function UpgradePrompt({
  title,
  description,
  planLabel,
}: {
  title: string;
  description: string;
  /** Tier name shown on the CTA, e.g. "Básico", "Pro", "Cooperativa". */
  planLabel: string;
}) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
        <AppIcons.crown size={28} />
      </span>
      <h3 className="mt-4 text-lg font-bold text-road-900">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-road-600">{description}</p>
      <Button className="press mt-6" size="lg" onClick={() => navigate('/suscripcion')}>
        <AppIcons.crown size={18} /> {t('Mejorar a {plan}', { plan: planLabel })}
      </Button>
    </div>
  );
}
