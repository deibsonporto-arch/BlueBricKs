export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatNumberBR(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte texto digitado em pt-BR (vírgula decimal, ponto de milhar opcional) para number. Tolera também formato com ponto decimal. */
export function parseNumberBR(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
