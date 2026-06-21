import * as React from 'react';
import { useState } from 'react';
import { Input } from './input';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

/** 0 (empty) … 4 (strong) — drives the strength meter. */
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Show a 4-segment strength meter below the field. */
  showStrength?: boolean;
}

/** Password field with a show/hide toggle and optional strength meter. */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength, value, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const { t } = useI18n();
    const pw = typeof value === 'string' ? value : '';
    const score = passwordStrength(pw);
    const labels = [t('Muy débil'), t('Débil'), t('Aceptable'), t('Buena'), t('Fuerte')];
    const fill = [
      'bg-road-300',
      'bg-danger-500',
      'bg-amber-500',
      'bg-brand-400',
      'bg-brand-600',
    ][score];

    return (
      <div>
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            value={value}
            className={cn('pr-11', className)}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={visible ? t('Ocultar contraseña') : t('Mostrar contraseña')}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-r-xl text-road-400 transition-colors hover:text-road-700"
          >
            {visible ? <AppIcons.eyeOff size={18} /> : <AppIcons.eye size={18} />}
          </button>
        </div>
        {showStrength && pw.length > 0 && (
          <div className="mt-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i <= score ? fill : 'bg-road-200',
                  )}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-road-500">
              {t('Seguridad')}: {labels[score]}
            </p>
          </div>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
