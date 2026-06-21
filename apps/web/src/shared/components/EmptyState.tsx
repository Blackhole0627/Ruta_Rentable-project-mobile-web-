import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="relative mb-3.5 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-50 to-road-50 ring-1 ring-road-100" />
        <Icon className="relative h-8 w-8 text-brand-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold text-road-900">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-road-500">{description}</p>
      {actionLabel && onAction && (
        <Button className="press mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
