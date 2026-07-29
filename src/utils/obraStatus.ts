import type { Obra, StatusObra, StatusAtividade } from '../types/domain';
import { isPast, todayISO } from './dateUtils';

export function computeStatus(obra: Obra, atividades: { status: StatusAtividade }[] = []): StatusObra {
  if (obra.status === 'concluida' || obra.status === 'paralisada') return obra.status;
  if (isPast(obra.previsaoEntrega) && obra.previsaoEntrega !== todayISO()) return 'atrasada';
  if (obra.status === 'nao_iniciada' && atividades.some((a) => a.status !== 'pendente')) return 'em_andamento';
  return obra.status;
}

export const OBRA_STATUS_LABEL: Record<StatusObra, string> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  paralisada: 'Paralisada',
};

export const ATIVIDADE_STATUS_LABEL: Record<StatusAtividade, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

export const SUBATIVIDADE_DISPLAY_LABEL: Record<StatusAtividade | 'atrasada', string> = {
  ...ATIVIDADE_STATUS_LABEL,
  atrasada: 'Atrasada',
};
