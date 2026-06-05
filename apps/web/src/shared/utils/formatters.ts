import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(date: Date): string {
  return format(date, "d MMM yyyy, HH:mm", { locale: es });
}

export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}
