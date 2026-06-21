import { cn } from '@/shared/utils/cn';

/** Animated placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-br from-road-100 to-road-200/60',
        className,
      )}
    />
  );
}
