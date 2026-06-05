import type { Currency } from '@shared/types/user.types';

const USD_RATE = 36.5;

export function formatCurrency(
  amount: number,
  currency: Currency,
  options?: { compact?: boolean },
): string {
  const value = currency === 'USD' ? amount / USD_RATE : amount;
  const symbol = currency === 'USD' ? 'US$' : 'C$';
  const formatted = options?.compact
    ? value.toFixed(0)
    : value.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}
