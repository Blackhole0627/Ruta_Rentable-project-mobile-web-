import { useToastStore, type ToastKind } from '@/core/store/useToastStore';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';

const STYLES: Record<ToastKind, { wrap: string; icon: typeof AppIcons.success }> = {
  success: { wrap: 'border-brand-200 bg-brand-50 text-brand-800', icon: AppIcons.success },
  error: { wrap: 'border-red-200 bg-red-50 text-danger-600', icon: AppIcons.alert },
  info: { wrap: 'border-road-200 bg-white text-road-700', icon: AppIcons.info },
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
              'animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-lg shadow-road-900/10',
              style.wrap,
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-snug">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
