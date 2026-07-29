import { businessDaysBetween, parseISODate } from './dateUtils';

export interface DatedItem {
  dataInicio: string;
  dataFim: string;
}

/** % do total de dias úteis do item (atividade ou subatividade) que caem dentro do mês informado. */
export function pmoPrevistoPct(item: DatedItem, year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const itemStart = parseISODate(item.dataInicio);
  const itemEnd = parseISODate(item.dataFim);

  const overlapStart = itemStart > monthStart ? itemStart : monthStart;
  const overlapEnd = itemEnd < monthEnd ? itemEnd : monthEnd;
  if (overlapStart > overlapEnd) return 0;

  const overlapDays = businessDaysBetween(
    overlapStart.toISOString().slice(0, 10),
    overlapEnd.toISOString().slice(0, 10),
  );
  const totalDays = Math.max(1, businessDaysBetween(item.dataInicio, item.dataFim));
  return Math.round((overlapDays / totalDays) * 100);
}

export function itemOverlapsMonth(item: DatedItem, year: number, month: number): boolean {
  return pmoPrevistoPct(item, year, month) > 0;
}
