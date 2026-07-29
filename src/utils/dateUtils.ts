export function parseISODate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

export function diffDays(from: string, to: string): number {
  const a = parseISODate(from).getTime();
  const b = parseISODate(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string): string {
  const d = parseISODate(value);
  return d.toLocaleDateString('pt-BR');
}

export function isPast(value: string): boolean {
  return parseISODate(value).getTime() < parseISODate(todayISO()).getTime();
}

export function isWeekend(value: string): boolean {
  const day = parseISODate(value).getDay();
  return day === 0 || day === 6;
}

export interface MonthBucket {
  key: string; // "2024-01"
  label: string; // "Jan/24"
  startOffsetPct: number;
  widthPct: number;
}

export function monthsBetween(start: string, end: string): MonthBucket[] {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  const totalDays = Math.max(1, diffDays(start, end));

  const months: MonthBucket[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  while (cursor <= endDate) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const visibleStart = monthStart < startDate ? startDate : monthStart;
    const visibleEnd = monthEnd > endDate ? endDate : monthEnd;

    const startOffsetDays = Math.max(0, (visibleStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const widthDays = Math.max(0, (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24) + 1);

    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: `${monthNames[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
      startOffsetPct: (startOffsetDays / totalDays) * 100,
      widthPct: (widthDays / totalDays) * 100,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export function pctOffset(rangeStart: string, rangeEnd: string, value: string): number {
  const totalDays = Math.max(1, diffDays(rangeStart, rangeEnd));
  const offsetDays = diffDays(rangeStart, value);
  return Math.min(100, Math.max(0, (offsetDays / totalDays) * 100));
}

export function addDays(value: string, days: number): string {
  const d = parseISODate(value);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Duração em dias corridos, inclusive (início e fim iguais = 1 dia). */
export function durationDays(from: string, to: string): number {
  return diffDays(from, to) + 1;
}

/** Data final a partir da data de início e de uma duração em dias corridos (inclusive). */
export function endDateFromDuration(start: string, duration: number): string {
  return addDays(start, Math.max(1, duration) - 1);
}

/** Conta dias úteis (seg-sex) entre duas datas, inclusive. */
export function businessDaysBetween(from: string, to: string): number {
  const start = parseISODate(from);
  const end = parseISODate(to);
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Data final a partir da data de início e de uma duração em dias ÚTEIS (pula sábados e domingos), inclusive. */
export function endDateFromDurationUteis(start: string, duration: number): string {
  const target = Math.max(1, duration);
  const cursor = parseISODate(start);
  let count = 0;
  let result = start;
  while (count < target) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count++;
      result = cursor.toISOString().slice(0, 10);
    }
    if (count < target) cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function weekdayAbbr(value: string): string {
  return WEEKDAY_ABBR[parseISODate(value).getDay()];
}

/** Data curta com ano de 2 dígitos, ex: "27/05/26". */
export function formatDateShort(value: string): string {
  const d = parseISODate(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Data curta com dia da semana, ex: "Qua 27/05/26". */
export function formatDateWithWeekday(value: string): string {
  return `${weekdayAbbr(value)} ${formatDateShort(value)}`;
}

const FULL_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Chave "AAAA-MM" do mês de uma data ISO, para agrupamento. */
export function monthKey(value: string): string {
  return value.slice(0, 7);
}

/** Rótulo por extenso do mês de uma data, ex: "Julho 2026". */
export function monthLabel(value: string): string {
  const d = parseISODate(value);
  return `${FULL_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export interface WeekBucket {
  index: number; // 1-based (S1, S2, ...)
  label: string; // "S1 (29/07–04/08)"
  start: string;
  end: string;
}

/** Divide um mês em semanas reais (seg-dom), rotuladas S1..S5, cruzando para meses vizinhos quando necessário. */
export function weekBucketsOfMonth(year: number, month: number): WeekBucket[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // volta até a segunda-feira que contém o primeiro dia do mês
  const firstWeekStart = new Date(monthStart);
  const startDow = (firstWeekStart.getDay() + 6) % 7; // 0 = segunda
  firstWeekStart.setDate(firstWeekStart.getDate() - startDow);

  const weeks: WeekBucket[] = [];
  const cursor = new Date(firstWeekStart);
  let index = 1;
  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    weeks.push({
      index,
      label: `S${index} (${fmt(weekStart)}–${fmt(weekEnd)})`,
      start: weekStart.toISOString().slice(0, 10),
      end: weekEnd.toISOString().slice(0, 10),
    });

    cursor.setDate(cursor.getDate() + 7);
    index += 1;
  }

  return weeks;
}
