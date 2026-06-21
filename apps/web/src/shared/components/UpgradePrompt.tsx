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
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-white px-4 py-9 text-center shadow-card ring-1 ring-road-100">
      {/* Soft emerald glow behind the lock badge */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-50 to-transparent" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-grad text-white shadow-brand ring-4 ring-white">
        <AppIcons.crown size={28} />
      </span>
      <h3 className="relative mt-3.5 text-lg font-bold text-road-900">{title}</h3>
      <p className="relative mt-1.5 max-w-xs text-sm leading-relaxed text-road-500">{description}</p>
      <Button
        variant="gold"
        className="press relative mt-4"
        size="lg"
        onClick={() => navigate('/suscripcion')}
      >
        <AppIcons.crown size={18} /> {t('Mejorar a {plan}', { plan: planLabel })}
      </Button>
    </div>
  );
}
