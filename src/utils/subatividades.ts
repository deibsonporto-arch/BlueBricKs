import type { Atividade, Equipamento, MaoDeObra, Material, StatusAtividade, Subatividade } from '../types/domain';
import { addDays, businessDaysBetween, diffDays, durationDays, endDateFromDuration, endDateFromDurationUteis, isPast } from './dateUtils';

/** Profundidade de recuo (cascata) de uma subatividade: sobe a cadeia de predecessoras locais (mesma atividade) contando quantos elos até chegar numa sem predecessora local. Com 2 predecessoras, usa a mais profunda. Só para exibição — não afeta a ordem da lista. */
function computeDepth(s: Subatividade, byId: Map<string, Subatividade>, seen: Set<string>): number {
  if (s.dependeDe.length === 0 || seen.has(s.id)) return 0;
  const profundidades = s.dependeDe
    .map((id) => byId.get(id))
    .filter((predecessora): predecessora is Subatividade => !!predecessora)
    .map((predecessora) => 1 + computeDepth(predecessora, byId, new Set(seen).add(s.id)));
  return profundidades.length > 0 ? Math.max(...profundidades) : 0;
}

/** Lista de subatividades ordenada por `ordem` (posição manual, ajustável arrastando na tabela) — a ordem nunca é travada pelo encadeamento de predecessoras. `depth` indica a cascata visual: quanto uma subatividade está "aninhada" na cadeia de predecessoras locais, para o usuário enxergar a dependência mesmo com a lista solta. */
export function getOrderedSubatividades(subatividades: Subatividade[]): { subatividade: Subatividade; depth: number }[] {
  const byId = new Map(subatividades.map((s) => [s.id, s]));
  return subatividades
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((s) => ({ subatividade: s, depth: computeDepth(s, byId, new Set()) }));
}

function findPredecessorDataFim(predecessorId: string, atividades: Atividade[]): string | undefined {
  for (const a of atividades) {
    if (a.id === predecessorId) return a.dataFim;
    const found = a.subatividades.find((s) => s.id === predecessorId);
    if (found) return found.dataFim;
  }
  return undefined;
}

/** Fim mais tardio entre até 2 predecessoras — com 2 vinculadas, espera as duas terminarem antes de liberar a data. */
function maxPredecessorDataFim(predecessorIds: string[], atividades: Atividade[]): string | undefined {
  const fins = predecessorIds
    .map((id) => findPredecessorDataFim(id, atividades))
    .filter((fim): fim is string => !!fim);
  if (fins.length === 0) return undefined;
  return fins.reduce((max, fim) => (fim > max ? fim : max), fins[0]);
}

/** Duração atual da subatividade, contada no seu próprio modo (dias corridos ou só dias úteis). */
function subatividadeDuracao(sub: Subatividade): number {
  return sub.contagemDias === 'uteis' ? businessDaysBetween(sub.dataInicio, sub.dataFim) : durationDays(sub.dataInicio, sub.dataFim);
}

function subatividadeEndDateFromDuracao(start: string, duracao: number, contagemDias: Subatividade['contagemDias']): string {
  return contagemDias === 'uteis' ? endDateFromDurationUteis(start, duracao) : endDateFromDuration(start, duracao);
}

/**
 * Se a subatividade tem predecessora própria e está no modo automático (dataAutomatica !== false), ajusta
 * dataInicio/dataFim para começar 1 dia (+ dias de espera/cura) após o fim da predecessora, preservando a
 * duração. Se ela NÃO tem predecessora própria mas a atividade-mãe tem (predecessora escolhida no nível da
 * etapa, em `atividadeDependeDe`), usa o fim mais tardio das predecessoras da etapa como âncora — sem isso, a
 * predecessora escolhida para a etapa como um todo era só decorativa quando a etapa tinha subatividades,
 * porque a data vem sempre do agregado das subatividades, nunca de resolveAtividadeDates. Se o usuário
 * desligou o automático, respeita a data manual e não mexe em nada.
 */
export function resolveSubatividadeDates(sub: Subatividade, atividades: Atividade[], atividadeDependeDe: string[] = []): Subatividade {
  if (sub.dataAutomatica === false) return sub;

  let predecessorFim: string | undefined;
  let espera = 0;
  if (sub.dependeDe.length > 0) {
    predecessorFim = maxPredecessorDataFim(sub.dependeDe, atividades);
    espera = sub.diasEsperaAposPredecessora ?? 0;
  } else if (atividadeDependeDe.length > 0) {
    const predecessoras = atividadeDependeDe
      .map((id) => atividades.find((a) => a.id === id))
      .filter((a): a is Atividade => !!a);
    if (predecessoras.length > 0) {
      predecessorFim = predecessoras.reduce((max, p) => (p.dataFim > max ? p.dataFim : max), predecessoras[0].dataFim);
    }
  } else {
    return sub;
  }
  if (!predecessorFim) return sub;

  const novaDataInicio = addDays(predecessorFim, 1 + espera);
  if (novaDataInicio === sub.dataInicio) return sub;

  const duracao = subatividadeDuracao(sub);
  const novaDataFim = subatividadeEndDateFromDuracao(novaDataInicio, duracao, sub.contagemDias);
  return { ...sub, dataInicio: novaDataInicio, dataFim: novaDataFim };
}

export interface ParentAggregates {
  dataInicio: string;
  dataFim: string;
  custoMaoDeObra: number;
  custoMaterial: number;
  custoAluguel: number;
  materiaisNecessarios: Material[];
  maoDeObraNecessaria: MaoDeObra[];
  equipamentosAluguel: Equipamento[];
}

/** Agregados efetivos da atividade a partir das subatividades: datas (menor início, maior fim), custos (soma) e materiais/mão de obra/equipamentos (concatenados). Sem subatividades, mantém os valores atuais da própria atividade (fallback). */
export function recomputeParentAggregates(atividade: Atividade): ParentAggregates {
  if (atividade.subatividades.length === 0) {
    return {
      dataInicio: atividade.dataInicio,
      dataFim: atividade.dataFim,
      custoMaoDeObra: atividade.custoMaoDeObra,
      custoMaterial: atividade.custoMaterial,
      custoAluguel: atividade.custoAluguel,
      materiaisNecessarios: atividade.materiaisNecessarios,
      maoDeObraNecessaria: atividade.maoDeObraNecessaria,
      equipamentosAluguel: atividade.equipamentosAluguel,
    };
  }
  const subs = atividade.subatividades;
  const inicios = subs.map((s) => s.dataInicio);
  const fins = subs.map((s) => s.dataFim);
  return {
    dataInicio: inicios.reduce((min, d) => (d < min ? d : min)),
    dataFim: fins.reduce((max, d) => (d > max ? d : max)),
    custoMaoDeObra: subs.reduce((sum, s) => sum + s.custoMaoDeObra, 0),
    custoMaterial: subs.reduce((sum, s) => sum + s.custoMaterial, 0),
    custoAluguel: subs.reduce((sum, s) => sum + s.custoAluguel, 0),
    materiaisNecessarios: subs.flatMap((s) => s.materiaisNecessarios),
    maoDeObraNecessaria: subs.flatMap((s) => s.maoDeObraNecessaria),
    equipamentosAluguel: subs.flatMap((s) => s.equipamentosAluguel),
  };
}

/** Deriva o status da atividade-mãe a partir das subatividades: todas concluídas -> concluída (marca a atividade como concluída também); ao menos uma com algum progresso (concluída, iniciada ou não pendente) -> em andamento; senão pendente. Sem subatividades, não deriva nada — o status continua manual via checkbox da própria atividade. */
export function deriveParentStatus(subatividades: Subatividade[]): { status: StatusAtividade; concluida: boolean } | undefined {
  if (subatividades.length === 0) return undefined;
  if (subatividades.every((s) => s.concluida)) return { status: 'concluida', concluida: true };
  const algumaComProgresso = subatividades.some((s) => s.concluida || s.iniciada || s.status !== 'pendente');
  return algumaComProgresso ? { status: 'em_andamento', concluida: false } : { status: 'pendente', concluida: false };
}

export type SubatividadeDisplayStatus = StatusAtividade | 'atrasada';

/** Uma atividade/subatividade está atrasada quando a data de fim planejada já passou e ela ainda não foi concluída — vale tanto para quem nunca foi iniciada quanto para quem está em andamento. */
export function isAtrasado(item: { dataFim: string; concluida: boolean }): boolean {
  return !item.concluida && isPast(item.dataFim);
}

/** Status de exibição derivado (não altera o campo `status` armazenado): concluída > atrasada (dataFim já passou e não foi concluída) > em andamento (marcada como iniciada) > pendente. */
export function getSubatividadeDisplayStatus(s: Subatividade): SubatividadeDisplayStatus {
  if (s.concluida) return 'concluida';
  if (isAtrasado(s)) return 'atrasada';
  if (s.iniciada) return 'em_andamento';
  return 'pendente';
}

/**
 * Monta o patch para reagendar o início de uma atividade/subatividade atrasada. Se ela já estava
 * atrasada e ainda não tem `dataInicioOriginal` registrada, guarda a data de início atual (a que foi
 * perdida) antes de sobrescrever — assim o atraso fica documentado mesmo depois de reagendada.
 */
export function buildReagendamentoPatch(
  item: { dataInicio: string; dataFim: string; concluida: boolean; dataInicioOriginal?: string },
  novaDataInicio: string,
): { dataInicio: string; dataInicioOriginal?: string } {
  if (isAtrasado(item) && !item.dataInicioOriginal) {
    return { dataInicio: novaDataInicio, dataInicioOriginal: item.dataInicio };
  }
  return { dataInicio: novaDataInicio };
}

/**
 * Variante de `buildReagendamentoPatch` para o botão rápido "Nova data de início" (PMO), que só expõe
 * um campo. Além de guardar a data original, empurra `dataFim` junto pelo mesmo número de dias — preserva
 * a duração e faz o item sair do estado "atrasada" assim que reagendado para o futuro.
 */
export function buildReagendamentoAtrasoPatch(
  item: { dataInicio: string; dataFim: string; concluida: boolean; dataInicioOriginal?: string },
  novaDataInicio: string,
): { dataInicio: string; dataFim: string; dataInicioOriginal?: string } {
  const deltaDias = diffDays(item.dataInicio, novaDataInicio);
  const novaDataFim = addDays(item.dataFim, deltaDias);
  return { ...buildReagendamentoPatch(item, novaDataInicio), dataFim: novaDataFim };
}

/** Numeração hierárquica: "2" para atividade top-level, "2.1" para subatividade. */
export function getTaskNumber(atividades: Atividade[], id: string): string {
  const parentIndex = atividades.findIndex((a) => a.id === id);
  if (parentIndex !== -1) return String(parentIndex + 1);

  for (let i = 0; i < atividades.length; i++) {
    const ordered = getOrderedSubatividades(atividades[i].subatividades);
    const subIndex = ordered.findIndex(({ subatividade }) => subatividade.id === id);
    if (subIndex !== -1) return `${i + 1}.${subIndex + 1}`;
  }
  return '?';
}

export function getTaskLabel(atividades: Atividade[], id: string): string {
  for (const a of atividades) {
    if (a.id === id) return a.nome;
    const found = a.subatividades.find((s) => s.id === id);
    if (found) return found.nome;
  }
  return '';
}

/** ids que dependem (direta ou transitivamente) de `id`, considerando atividades e subatividades num único grafo — usado para excluir ciclos nos seletores de predecessora. */
export function getDescendantIds(id: string, atividades: Atividade[]): Set<string> {
  const edges: { id: string; dependeDe: string[] }[] = [];
  for (const a of atividades) {
    edges.push({ id: a.id, dependeDe: a.dependeDe });
    for (const s of a.subatividades) {
      edges.push({ id: s.id, dependeDe: s.dependeDe });
    }
  }

  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (e.dependeDe.some((dep) => dep === id || descendants.has(dep)) && !descendants.has(e.id)) {
        descendants.add(e.id);
        changed = true;
      }
    }
  }
  return descendants;
}
