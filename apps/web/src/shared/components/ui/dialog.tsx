import * as React from 'react';
import { cn } from '@/shared/utils/cn';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/** Lightweight modal dialog with an overlay; used by driver and admin surfaces. */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-road-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-road-100 p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-road-500 hover:bg-road-100"
          >
            <AppIcons.close {...iconPropsSm} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
