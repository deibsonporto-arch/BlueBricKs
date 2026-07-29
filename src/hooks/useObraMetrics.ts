import { useMemo } from 'react';
import type { Atividade, LancamentoFinanceiro, Obra } from '../types/domain';
import { computeStatus } from '../utils/obraStatus';
import { diffDays, todayISO } from '../utils/dateUtils';

export function useObrasListMetrics(obras: Obra[], atividades: Atividade[]) {
  return useMemo(() => {
    const withStatus = obras.map((o) => computeStatus(o, atividades.filter((a) => a.obraId === o.id)));
    return {
      total: obras.length,
      emAndamento: withStatus.filter((s) => s === 'em_andamento').length,
      atrasadas: withStatus.filter((s) => s === 'atrasada').length,
      paralisadas: withStatus.filter((s) => s === 'paralisada').length,
    };
  }, [obras, atividades]);
}

export function useObraDetailMetrics(obra: Obra | undefined, atividades: Atividade[], lancamentos: LancamentoFinanceiro[] = []) {
  return useMemo(() => {
    if (!obra) return null;

    const gastoReal = lancamentos.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valorPago, 0);
    const gastoRealPct = obra.orcamentoTotal > 0 ? (gastoReal / obra.orcamentoTotal) * 100 : 0;

    const prazoRestante = diffDays(todayISO(), obra.previsaoEntrega);

    const totalAtividades = atividades.length;
    const concluidas = atividades.filter((a) => a.concluida).length;
    const avancoFisicoReal = totalAtividades > 0 ? (concluidas / totalAtividades) * 100 : obra.progressoFisico;

    const inicioTotal = Math.max(1, diffDays(obra.dataInicio, obra.previsaoEntrega));
    const decorrido = Math.min(inicioTotal, Math.max(0, diffDays(obra.dataInicio, todayISO())));
    const avancoFisicoPrevisto = obra.progressoFisicoPrevisto ?? (decorrido / inicioTotal) * 100;

    return {
      orcamentoTotal: obra.orcamentoTotal,
      gastoReal,
      gastoRealPct,
      prazoRestante,
      avancoFisicoReal,
      avancoFisicoPrevisto,
    };
  }, [obra, atividades]);
}
