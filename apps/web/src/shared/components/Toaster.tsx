import { useToastStore, type ToastKind } from '@/core/store/useToastStore';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';

const STYLES: Record<
  ToastKind,
  { wrap: string; iconWrap: string; icon: typeof AppIcons.success }
> = {
  success: {
    wrap: 'ring-brand-200 bg-white text-brand-800',
    iconWrap: 'bg-brand-100 text-brand-600',
    icon: AppIcons.success,
  },
  error: {
    wrap: 'ring-danger-100 bg-white text-danger-700',
    iconWrap: 'bg-danger-50 text-danger-500',
    icon: AppIcons.alert,
  },
  info: {
    wrap: 'ring-road-100 bg-white text-road-700',
    iconWrap: 'bg-road-100 text-road-500',
    icon: AppIcons.info,
  },
};

/**
 * App-wide toast stack. Mounted once near the root; reads from the toast store
 * so any handler can call `toast.success(...)`. Top-center, taps to dismiss.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-safe">
      <div className="h-2" />
      {toasts.map((t) => {
        const style = STYLES[t.kind];
        const Icon = style.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={cn(
              'animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold shadow-card-lg ring-1 ring-inset',
              style.wrap,
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                style.iconWrap,
              )}
            >
              <Icon size={18} />
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
