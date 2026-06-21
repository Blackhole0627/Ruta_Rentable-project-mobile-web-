import { useNavigate } from 'react-router-dom';
import { useReminders } from '@/shared/hooks/useReminders';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

/** Renders dismissible in-app reminders (S3 alerts). */
export function ReminderBanners() {
  const navigate = useNavigate();
  const { reminders, dismiss } = useReminders();
  const { t } = useI18n();

  if (reminders.length === 0) return null;

  return (
    <div className="space-y-2">
      {reminders.map((r) => (
        <div
          key={r.id}
          className={cn(
            'flex items-start gap-2.5 rounded-2xl p-3 shadow-card ring-1 ring-inset',
            r.tone === 'warn'
              ? 'bg-amber-50/80 ring-amber-200'
              : 'bg-brand-50/80 ring-brand-200',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
              r.tone === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-brand-100 text-brand-600',
            )}
          >
            <AppIcons.reminder size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-road-900">{t(r.title, r.vars)}</p>
            <p className="text-xs text-road-600">{t(r.message)}</p>
            {r.to && r.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  dismiss(r.id);
                  navigate(r.to!);
                }}
                className="mt-1.5 text-xs font-semibold text-brand-700 underline"
              >
                {t(r.actionLabel)}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(r.id)}
            aria-label="Descartar"
            className="press -m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-road-400 hover:bg-road-100/60 hover:text-road-700"
          >
            <AppIcons.close size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
