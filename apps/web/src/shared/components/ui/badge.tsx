import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-road-100 text-road-700 ring-road-200',
        profitable: 'bg-brand-50 text-brand-700 ring-brand-200',
        acceptable: 'bg-amber-50 text-amber-700 ring-amber-200',
        danger: 'bg-danger-50 text-danger-700 ring-danger-100',
        gold: 'bg-gold-100 text-gold-800 ring-gold-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
