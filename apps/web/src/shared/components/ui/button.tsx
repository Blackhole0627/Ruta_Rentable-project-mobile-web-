import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none min-h-[40px] min-w-[40px] px-3.5',
  {
    variants: {
      variant: {
        default:
          'bg-brand-grad text-white shadow-brand hover:shadow-brand-lg hover:brightness-[1.04]',
        secondary: 'bg-road-100 text-road-800 hover:bg-road-200',
        outline:
          'border border-road-200 bg-white text-road-800 shadow-sm hover:bg-road-50 hover:border-road-300',
        ghost: 'text-road-700 hover:bg-road-100',
        gold: 'bg-gold-grad text-gold-900 shadow-sm hover:brightness-[1.04]',
        destructive:
          'bg-danger-500 text-white shadow-sm hover:bg-danger-600 active:bg-danger-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-[13px]',
        lg: 'h-11 rounded-2xl px-6 text-[15px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';
