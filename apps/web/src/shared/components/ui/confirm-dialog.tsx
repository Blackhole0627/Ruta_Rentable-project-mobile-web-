import { useState } from 'react';
import { Dialog } from './dialog';
import { Button } from './button';
import { useI18n } from '@/core/i18n/i18n';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Label for the confirming action. Defaults to a generic "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true the confirm button uses the destructive (red) styling. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Reusable confirmation modal for destructive actions (delete, remove). Keeps
 * the confirm button disabled while the async action is in flight so a slow
 * backend can't be double-submitted, and closes only after it resolves.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const [working, setWorking] = useState(false);

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onClose={working ? () => {} : onCancel} title={title}>
      <p className="text-sm leading-relaxed text-road-500">{message}</p>
      <div className="mt-3 flex gap-2.5">
        <Button variant="outline" className="press flex-1" disabled={working} onClick={onCancel}>
          {cancelLabel ?? t('Cancelar')}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          className="press flex-1"
          disabled={working}
          onClick={handleConfirm}
        >
          {working ? t('Procesando…') : confirmLabel ?? t('Confirmar')}
        </Button>
      </div>
    </Dialog>
  );
}
