import type { Atividade } from '../types/domain';
import { addDays, diffDays, endDateFromDuration } from './dateUtils';

/**
 * Se a atividade não tem subatividades (que já agregam data via recomputeParentAggregates), tem ao menos uma
 * predecessora (dependeDe, até 2) e está no modo automático (dataAutomatica !== false), calcula dataInicio a
 * partir do fim MAIS TARDIO entre as predecessoras + 1 dia (com 2 predecessoras, espera as duas terminarem).
 * dataFim usa duracaoSemanas quando definida, ou preserva a duração atual. Sem predecessora, a data é sempre
 * manual (mesmo comportamento de resolveSubatividadeDates) — só é definida na criação (dataInicio da obra) e
 * depois só muda se o usuário editar diretamente.
 */
export function resolveAtividadeDates(atividade: Atividade, todasAtividades: Atividade[]): Atividade {
  if (atividade.subatividades.length > 0) return atividade;
  if (atividade.dependeDe.length === 0) return atividade;
  if (atividade.dataAutomatica === false) return atividade;

  const predecessoras = atividade.dependeDe
    .map((id) => todasAtividades.find((a) => a.id === id))
    .filter((a): a is Atividade => !!a);
  if (predecessoras.length === 0) return atividade;

  const fimMaisTardio = predecessoras.reduce((max, p) => (p.dataFim > max ? p.dataFim : max), predecessoras[0].dataFim);
  const novaDataInicio = addDays(fimMaisTardio, 1);

  const duracaoDias = atividade.duracaoDias ?? (atividade.duracaoSemanas ? atividade.duracaoSemanas * 7 : diffDays(atividade.dataInicio, atividade.dataFim) + 1);
  const novaDataFim = endDateFromDuration(novaDataInicio, duracaoDias);

  if (novaDataInicio === atividade.dataInicio && novaDataFim === atividade.dataFim) return atividade;
  return { ...atividade, dataInicio: novaDataInicio, dataFim: novaDataFim };
}
