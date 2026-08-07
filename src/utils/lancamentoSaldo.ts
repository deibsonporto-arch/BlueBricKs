import type { LancamentoFinanceiro } from '../types/domain';

/**
 * Quanto ainda falta pagar deste lançamento. `valorPago` guarda o valor total do contrato/nota,
 * não o saldo pendente — lançamentos com pagamentos parciais confirmados (entrada paga, parcela
 * paga, etc.) precisam descontar o que já está em `pagamentos[]` antes de entrar em qualquer soma
 * de "saldo a pagar", "vencendo hoje" ou "falta pagar". Lançamentos já quitados (status 'pago')
 * ou sem valor previsto não têm saldo restante.
 */
export function saldoRestante(l: LancamentoFinanceiro): number {
  if (l.naoPrevisto || l.status === 'pago') return 0;
  const jaPago = (l.pagamentos ?? []).reduce((s, p) => s + p.valor, 0);
  return Math.max(0, l.valorPago - jaPago);
}
