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
            'flex items-start gap-3 rounded-lg border p-3',
            r.tone === 'warn'
              ? 'border-amber-200 bg-amber-50'
              : 'border-brand-200 bg-brand-50',
          )}
        >
          <AppIcons.reminder
            size={18}
            className={cn('mt-0.5 shrink-0', r.tone === 'warn' ? 'text-amber-600' : 'text-brand-600')}
          />
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
            className="shrink-0 text-road-400 hover:text-road-700"
          >
            <AppIcons.close size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
