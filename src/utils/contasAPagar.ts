import type { LancamentoFinanceiro } from '../types/domain';
import { diffDays, isPast, todayISO } from './dateUtils';

export type VencimentoBucket = 'hoje' | 'proximos7' | 'vencidas' | 'pagas' | 'pendentes';

export const VENCIMENTO_BUCKET_LABEL: Record<VencimentoBucket, string> = {
  hoje: 'Vencendo hoje',
  proximos7: 'Próximos 7 dias',
  vencidas: 'Vencidas',
  pagas: 'Pagas',
  pendentes: 'Pendentes',
};

export function lancamentoNoBucket(l: LancamentoFinanceiro, bucket: VencimentoBucket): boolean {
  const hoje = todayISO();
  switch (bucket) {
    case 'hoje':
      return l.dataVencimento === hoje && l.status !== 'pago';
    case 'proximos7': {
      const diff = diffDays(hoje, l.dataVencimento);
      return diff >= 0 && diff <= 7 && l.status !== 'pago';
    }
    case 'vencidas':
      return isPast(l.dataVencimento) && l.status !== 'pago';
    case 'pagas':
      return l.status === 'pago';
    case 'pendentes':
      return l.status !== 'pago';
  }
}

export function bucketSummary(lancamentos: LancamentoFinanceiro[], bucket: VencimentoBucket) {
  const itens = lancamentos.filter((l) => lancamentoNoBucket(l, bucket));
  const total = itens.reduce((s, l) => s + l.valorPago, 0);
  return { count: itens.length, total };
}
