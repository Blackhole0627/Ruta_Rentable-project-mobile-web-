import { cn } from '@/shared/utils/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export function Switch({ checked, onCheckedChange, label, id }: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        checked ? 'bg-brand-500 shadow-[inset_0_1px_2px_rgba(5,150,105,0.4)]' : 'bg-road-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-1 ring-road-900/5 transition-transform duration-200 ease-out',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
