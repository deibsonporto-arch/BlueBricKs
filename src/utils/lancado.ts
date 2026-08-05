import type { LancadoTipo, LancamentoFinanceiro } from '../types/domain';

export const LANCADO_LABEL: Record<LancadoTipo, string> = {
  nao_lancado: 'Não lançado',
  com_adiantamento: 'Lançado c/ adiantamento',
  com_nf: 'Lançado C/NF',
  sem_nf: 'Lançado S/NF',
};

export const LANCADO_OPTIONS: LancadoTipo[] = ['nao_lancado', 'com_adiantamento', 'com_nf', 'sem_nf'];

/** Registros antigos só tinham o campo booleano `lancado` (sim/não) — quando não há `lancadoTipo`
 * definido, deriva um tipo equivalente a partir dele para não perder a informação existente. */
export function lancadoTipoEfetivo(l: Pick<LancamentoFinanceiro, 'lancado' | 'lancadoTipo'>): LancadoTipo {
  if (l.lancadoTipo) return l.lancadoTipo;
  return l.lancado ? 'com_nf' : 'nao_lancado';
}
