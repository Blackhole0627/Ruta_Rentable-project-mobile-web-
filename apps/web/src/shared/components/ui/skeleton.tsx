import { cn } from '@/shared/utils/cn';

/** Animated placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-road-200/70', className)} />;
}
