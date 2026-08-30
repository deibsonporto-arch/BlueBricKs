import { useCallback, useEffect, useRef, useState } from 'react';
import type { Atividade, Subatividade } from '../types/domain';
import { atividadeRepository } from '../data/repositories/atividadeRepository';
import { deriveParentStatus, recomputeParentAggregates, resolveSubatividadeDates } from '../utils/subatividades';
import { resolveAtividadeDates } from '../utils/atividadeSchedule';
import { generateId } from '../utils/id';
import { readCollection, writeCollection } from '../data/storage';
import { pushCollection } from '../data/apiSync';

const LIMITE_HISTORICO = 30;

/** Clona uma subatividade (e seus netos, recursivamente) com ids novos, zerando conclusão/andamento
 * — a cópia nasce pendente, pronta pra virar uma nova tarefa a partir do que já foi preenchido
 * (insumos, mão de obra, materiais, datas, custos) na original. */
function clonarSubatividade(s: Subatividade, renomear = true): Subatividade {
  return {
    ...s,
    id: generateId(),
    nome: renomear ? `${s.nome} (cópia)` : s.nome,
    concluida: false,
    iniciada: false,
    status: 'pendente',
    dependeDe: [],
    insumos: s.insumos?.map((i) => ({ ...i, id: generateId() })),
    materiaisNecessarios: s.materiaisNecessarios.map((m) => ({ ...m })),
    maoDeObraNecessaria: s.maoDeObraNecessaria.map((m) => ({ ...m })),
    equipamentosAluguel: s.equipamentosAluguel.map((e) => ({ ...e })),
    subatividades: s.subatividades?.map((n) => ({ ...clonarSubatividade(n, renomear), dependeDe: [] })),
  };
}

export function isBlocked(atividade: Atividade, all: Atividade[]): boolean {
  return atividade.dependeDe.some((depId) => {
    const dep = all.find((a) => a.id === depId);
    return dep ? !dep.concluida : false;
  });
}

/**
 * Reaplica resolveSubatividadeDates (dentro de atividades com subtarefas, alimentando os agregados do pai) e
 * resolveAtividadeDates (atividades sem subtarefas) na MESMA passada, até estabilizar. As duas resoluções
 * rodam juntas porque uma cadeia real mistura os dois tipos (ex.: uma etapa sem subtarefas que depende de
 * outra que tem, ou vice-versa) — rodar cada uma isolada deixava a outra metade da cadeia sem recalcular.
 */
function cascadeScheduleUpdates(obraId: string) {
  for (let pass = 0; pass < 8; pass++) {
    const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
    let anyChange = false;

    for (const atividade of all) {
      if (atividade.subatividades.length > 0) {
        let changed = false;
        const novasSubatividades = atividade.subatividades.map((s) => {
          if ((s.subatividades?.length ?? 0) > 0) {
            let changedNeto = false;
            const novosNetos = (s.subatividades ?? []).map((n) => {
              const resolved = resolveSubatividadeDates(n, all, s.dependeDe);
              if (resolved.dataInicio !== n.dataInicio || resolved.dataFim !== n.dataFim) changedNeto = true;
              return resolved;
            });
            if (!changedNeto) return s;
            changed = true;
            const aggregatesSub = recomputeParentAggregates({ ...s, subatividades: novosNetos });
            const derivedStatusSub = deriveParentStatus(novosNetos);
            return { ...s, subatividades: novosNetos, ...aggregatesSub, ...(derivedStatusSub ?? {}) };
          }
          const resolved = resolveSubatividadeDates(s, all, atividade.dependeDe);
          if (resolved.dataInicio !== s.dataInicio || resolved.dataFim !== s.dataFim) changed = true;
          return resolved;
        });

        if (changed) {
          const aggregates = recomputeParentAggregates({ ...atividade, subatividades: novasSubatividades });
          const derivedStatus = deriveParentStatus(novasSubatividades);
          atividadeRepository.update(atividade.id, {
            subatividades: novasSubatividades,
            ...aggregates,
            ...derivedStatus,
            updatedAt: new Date().toISOString(),
          });
          anyChange = true;
        }
      } else {
        const resolved = resolveAtividadeDates(atividade, all);
        if (resolved.dataInicio !== atividade.dataInicio || resolved.dataFim !== atividade.dataFim) {
          atividadeRepository.update(atividade.id, {
            dataInicio: resolved.dataInicio,
            dataFim: resolved.dataFim,
            updatedAt: new Date().toISOString(),
          });
          anyChange = true;
        }
      }
    }

    if (!anyChange) break;
  }
}

/**
 * Aplica uma mutação nos netos (3º nível) de uma subatividade e recalcula os agregados em cascata:
 * primeiro a subatividade-mãe a partir dos seus netos, depois a atividade-avó a partir das
 * subatividades — o mesmo encadeamento de `recomputeParentAggregates`/`deriveParentStatus` que já
 * existe entre atividade e subatividade, só que um nível abaixo.
 */
function applySubSubatividadeMutation(
  obraId: string,
  atividadeId: string,
  subatividadeId: string,
  mutateNetos: (netos: Subatividade[], all: Atividade[], atividade: Atividade, sub: Subatividade) => Subatividade[],
) {
  const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
  const atividade = all.find((a) => a.id === atividadeId);
  if (!atividade) return;
  const sub = atividade.subatividades.find((s) => s.id === subatividadeId);
  if (!sub) return;

  const novosNetos = mutateNetos(sub.subatividades ?? [], all, atividade, sub);
  const aggregatesSub = recomputeParentAggregates({ ...sub, subatividades: novosNetos });
  const derivedStatusSub = deriveParentStatus(novosNetos);
  const subAtualizada: Subatividade = { ...sub, subatividades: novosNetos, ...aggregatesSub, ...(derivedStatusSub ?? {}) };

  const novasSubatividades = atividade.subatividades.map((s) => (s.id === subatividadeId ? subAtualizada : s));
  const aggregates = recomputeParentAggregates({ ...atividade, subatividades: novasSubatividades });
  const derivedStatus = deriveParentStatus(novasSubatividades);
  atividadeRepository.update(atividadeId, {
    subatividades: novasSubatividades,
    ...aggregates,
    ...derivedStatus,
    updatedAt: new Date().toISOString(),
  });
}

/** Corrige recursivamente insumos que vieram das Medidas do ambiente antes de existir o tipo
 * "parâmetro calculado" — ficaram marcados como Material (têm `origemCalculo` mas tipo errado).
 * Devolve a subatividade sem alterações se não achar nada pra corrigir (evita escritas à toa). */
function corrigirInsumosCalculados(s: Subatividade): Subatividade {
  const filhosCorrigidos = s.subatividades?.map(corrigirInsumosCalculados);
  const filhosMudaram = filhosCorrigidos?.some((f, i) => f !== s.subatividades![i]) ?? false;

  const precisaCorrigirInsumos = (s.insumos ?? []).some((i) => i.origemCalculo && i.tipo !== 'parametro_calculado');
  if (!precisaCorrigirInsumos && !filhosMudaram) return s;

  return {
    ...s,
    insumos: precisaCorrigirInsumos
      ? s.insumos!.map((i) => (i.origemCalculo && i.tipo !== 'parametro_calculado' ? { ...i, tipo: 'parametro_calculado' as const } : i))
      : s.insumos,
    subatividades: filhosMudaram ? filhosCorrigidos : s.subatividades,
  };
}

function migrarParametrosCalculados(obraId: string) {
  const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
  for (const atividade of all) {
    const novasSubatividades = atividade.subatividades.map(corrigirInsumosCalculados);
    const mudou = novasSubatividades.some((s, i) => s !== atividade.subatividades[i]);
    if (mudou) {
      atividadeRepository.update(atividade.id, { subatividades: novasSubatividades, updatedAt: new Date().toISOString() });
    }
  }
}

export function useAtividades(obraId: string) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  // desfazer/refazer: pilha de fotos (snapshots) das atividades desta obra, tiradas ANTES de cada
  // ação que muda algo — só existe em memória (não sobrevive a um reload), suficiente pra "desfaz a
  // última ação" em uma sessão de edição.
  const undoStackRef = useRef<Atividade[][]>([]);
  const redoStackRef = useRef<Atividade[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function snapshotAtual(): Atividade[] {
    return JSON.parse(JSON.stringify(atividadeRepository.list().filter((a) => a.obraId === obraId))) as Atividade[];
  }

  function registrarHistorico() {
    undoStackRef.current.push(snapshotAtual());
    if (undoStackRef.current.length > LIMITE_HISTORICO) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function aplicarSnapshot(snap: Atividade[]) {
    const todas = readCollection<Atividade>('atividades');
    const deOutrasObras = todas.filter((a) => a.obraId !== obraId);
    const novaColecao = [...deOutrasObras, ...snap];
    writeCollection('atividades', novaColecao);
    pushCollection('atividades', novaColecao);
  }

  const undo = useCallback(() => {
    const anterior = undoStackRef.current.pop();
    if (!anterior) return;
    redoStackRef.current.push(snapshotAtual());
    aplicarSnapshot(anterior);
    refresh();
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const redo = useCallback(() => {
    const seguinte = redoStackRef.current.pop();
    if (!seguinte) return;
    undoStackRef.current.push(snapshotAtual());
    aplicarSnapshot(seguinte);
    refresh();
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const refresh = useCallback(() => {
    // Roda a cada refresh (inclusive na montagem) para autocorrigir cronogramas antigos que ficaram
    // com datas desatualizadas de antes desta cadeia unificada existir — não só em edições novas.
    cascadeScheduleUpdates(obraId);
    migrarParametrosCalculados(obraId);
    setAtividades(atividadeRepository.list().filter((a) => a.obraId === obraId));
  }, [obraId]);
  useEffect(() => refresh(), [refresh]);

  const createAtividade = useCallback(
    async (atividade: Atividade) => {
      registrarHistorico();
      atividadeRepository.create(atividade);
      refresh();
    },
    [refresh],
  );

  const updateAtividade = useCallback(
    async (id: string, patch: Partial<Atividade>) => {
      registrarHistorico();
      atividadeRepository.update(id, patch);
      refresh();
    },
    [obraId, refresh],
  );

  const deleteAtividade = useCallback(
    async (id: string) => {
      registrarHistorico();
      atividadeRepository.remove(id);
      refresh();
    },
    [obraId, refresh],
  );

  /** Mescla `sourceId` dentro de `targetId`: move todas as subatividades (com seus insumos, custos
   * etc.) para a atividade destino, repointa qualquer predecessora (de outras atividades/subatividades)
   * que apontava pra `sourceId`, e remove a atividade de origem. Usado quando "Usar etapas
   * pré-cadastradas" encontra uma atividade já lançada com nome diferente do padrão (ex: "Estruturas"
   * → "Supraestrutura") e o usuário escolhe unificar em vez de manter as duas separadas. */
  const mergeAtividade = useCallback(
    async (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const source = all.find((a) => a.id === sourceId);
      const target = all.find((a) => a.id === targetId);
      if (!source || !target) return;

      registrarHistorico();
      const now = new Date().toISOString();
      const subatividadesMescladas = [...target.subatividades, ...source.subatividades];
      const aggregates = recomputeParentAggregates({ ...target, subatividades: subatividadesMescladas });
      const derivedStatus = deriveParentStatus(subatividadesMescladas);

      atividadeRepository.update(targetId, {
        subatividades: subatividadesMescladas,
        ...aggregates,
        ...derivedStatus,
        updatedAt: now,
      });

      for (const a of all) {
        if (a.id === sourceId || a.id === targetId) continue;
        const novoDependeDe = a.dependeDe.map((id) => (id === sourceId ? targetId : id));
        const novasSubatividades = a.subatividades.map((s) => ({
          ...s,
          dependeDe: s.dependeDe.map((id) => (id === sourceId ? targetId : id)),
        }));
        const mudouDependeDe = novoDependeDe.some((id, i) => id !== a.dependeDe[i]);
        const mudouSub = novasSubatividades.some((s, i) => s.dependeDe.some((id, j) => id !== a.subatividades[i].dependeDe[j]));
        if (mudouDependeDe || mudouSub) {
          atividadeRepository.update(a.id, { dependeDe: novoDependeDe, subatividades: novasSubatividades, updatedAt: now });
        }
      }

      atividadeRepository.remove(sourceId);
      refresh();
    },
    [obraId, refresh],
  );

  const toggleConclusao = useCallback(
    async (id: string) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === id);
      if (!atividade) return;
      if (!atividade.concluida && isBlocked(atividade, all)) return;

      registrarHistorico();
      const willBeConcluida = !atividade.concluida;
      atividadeRepository.update(id, {
        concluida: willBeConcluida,
        status: willBeConcluida ? 'concluida' : 'pendente',
        updatedAt: new Date().toISOString(),
      });
      refresh();
    },
    [obraId, refresh],
  );

  const createSubatividade = useCallback(
    async (atividadeId: string, novaSubatividade: Subatividade) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === atividadeId);
      if (!atividade) return;

      registrarHistorico();
      const resolved = resolveSubatividadeDates(novaSubatividade, all, atividade.dependeDe);
      const novasSubatividades = [...atividade.subatividades, resolved];
      const aggregates = recomputeParentAggregates({ ...atividade, subatividades: novasSubatividades });
      const derivedStatus = deriveParentStatus(novasSubatividades);

      atividadeRepository.update(atividadeId, {
        subatividades: novasSubatividades,
        ...aggregates,
        ...derivedStatus,
        updatedAt: new Date().toISOString(),
      });

      refresh();
    },
    [obraId, refresh],
  );

  /** Copia todas as subatividades de `atividadeOrigemId` (com insumos, mão de obra, materiais e
   * equipamentos) pro final da lista de `atividadeDestinoId` — ex: já criou WC-Térreo, WC-Mezanino
   * etc. na Alvenaria e quer a mesma lista de cômodos no Reboco, sem recriar um por um. As cópias
   * nascem pendentes, sem predecessora (não herdam a dependência da etapa de origem). */
  const copiarSubatividades = useCallback(
    async (atividadeOrigemId: string, atividadeDestinoId: string) => {
      if (atividadeOrigemId === atividadeDestinoId) return;
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const origem = all.find((a) => a.id === atividadeOrigemId);
      const destino = all.find((a) => a.id === atividadeDestinoId);
      if (!origem || !destino || origem.subatividades.length === 0) return;

      registrarHistorico();
      const copias = origem.subatividades.map((s) => clonarSubatividade(s, false));
      const novasSubatividades = [...destino.subatividades, ...copias];
      const aggregates = recomputeParentAggregates({ ...destino, subatividades: novasSubatividades });
      const derivedStatus = deriveParentStatus(novasSubatividades);

      atividadeRepository.update(atividadeDestinoId, {
        subatividades: novasSubatividades,
        ...aggregates,
        ...derivedStatus,
        updatedAt: new Date().toISOString(),
      });
      refresh();
    },
    [obraId, refresh],
  );

  const updateSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string, patch: Partial<Subatividade>) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === atividadeId);
      if (!atividade) return;

      registrarHistorico();
      const novasSubatividades = atividade.subatividades.map((s) => {
        if (s.id !== subatividadeId) return s;
        return resolveSubatividadeDates({ ...s, ...patch }, all, atividade.dependeDe);
      });

      const aggregates = recomputeParentAggregates({ ...atividade, subatividades: novasSubatividades });
      const derivedStatus = deriveParentStatus(novasSubatividades);
      atividadeRepository.update(atividadeId, {
        subatividades: novasSubatividades,
        ...aggregates,
        ...derivedStatus,
        updatedAt: new Date().toISOString(),
      });

      refresh();
    },
    [obraId, refresh],
  );

  const duplicateSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === atividadeId);
      const original = atividade?.subatividades.find((s) => s.id === subatividadeId);
      if (!atividade || !original) return;

      registrarHistorico();
      const indice = atividade.subatividades.findIndex((s) => s.id === subatividadeId);
      const copia = clonarSubatividade(original);
      const novasSubatividades = [...atividade.subatividades];
      novasSubatividades.splice(indice + 1, 0, copia);

      const aggregates = recomputeParentAggregates({ ...atividade, subatividades: novasSubatividades });
      const derivedStatus = deriveParentStatus(novasSubatividades);
      atividadeRepository.update(atividadeId, {
        subatividades: novasSubatividades,
        ...aggregates,
        ...derivedStatus,
        updatedAt: new Date().toISOString(),
      });
      refresh();
    },
    [obraId, refresh],
  );

  const deleteSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === atividadeId);
      if (!atividade) return;

      registrarHistorico();
      const restantes = atividade.subatividades.filter((s) => s.id !== subatividadeId);
      const aggregates = recomputeParentAggregates({ ...atividade, subatividades: restantes });
      const derivedStatus = deriveParentStatus(restantes);
      atividadeRepository.update(atividadeId, {
        subatividades: restantes,
        ...aggregates,
        ...derivedStatus,
        updatedAt: new Date().toISOString(),
      });
      refresh();
    },
    [obraId, refresh],
  );

  const createSubSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string, novoNeto: Subatividade) => {
      registrarHistorico();
      applySubSubatividadeMutation(obraId, atividadeId, subatividadeId, (netos, all, _atividade, sub) => [
        ...netos,
        resolveSubatividadeDates(novoNeto, all, sub.dependeDe),
      ]);
      refresh();
    },
    [obraId, refresh],
  );

  const updateSubSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string, subSubatividadeId: string, patch: Partial<Subatividade>) => {
      registrarHistorico();
      applySubSubatividadeMutation(obraId, atividadeId, subatividadeId, (netos, all, _atividade, sub) =>
        netos.map((n) => (n.id === subSubatividadeId ? resolveSubatividadeDates({ ...n, ...patch }, all, sub.dependeDe) : n)),
      );
      refresh();
    },
    [obraId, refresh],
  );

  const deleteSubSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string, subSubatividadeId: string) => {
      registrarHistorico();
      applySubSubatividadeMutation(obraId, atividadeId, subatividadeId, (netos) => netos.filter((n) => n.id !== subSubatividadeId));
      refresh();
    },
    [obraId, refresh],
  );

  const reorderSubSubatividades = useCallback(
    async (atividadeId: string, subatividadeId: string, idsNaNovaOrdem: string[]) => {
      registrarHistorico();
      applySubSubatividadeMutation(obraId, atividadeId, subatividadeId, (netos) => {
        const ordemMap = new Map(idsNaNovaOrdem.map((id, i) => [id, i]));
        return netos.map((n) => ({ ...n, ordem: ordemMap.get(n.id) ?? n.ordem }));
      });
      refresh();
    },
    [obraId, refresh],
  );

  const reorderAtividades = useCallback(
    async (idsNaNovaOrdem: string[]) => {
      registrarHistorico();
      atividadeRepository.reorderByObra(obraId, idsNaNovaOrdem);
      refresh();
    },
    [obraId, refresh],
  );

  const reorderSubatividades = useCallback(
    async (atividadeId: string, idsNaNovaOrdem: string[]) => {
      const atividade = atividadeRepository.get(atividadeId);
      if (!atividade) return;

      registrarHistorico();
      const ordemMap = new Map(idsNaNovaOrdem.map((id, i) => [id, i]));
      const reordenadas = atividade.subatividades.map((s) => ({
        ...s,
        ordem: ordemMap.get(s.id) ?? s.ordem,
      }));

      atividadeRepository.update(atividadeId, { subatividades: reordenadas, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  return {
    atividades,
    createAtividade,
    updateAtividade,
    deleteAtividade,
    mergeAtividade,
    toggleConclusao,
    createSubatividade,
    updateSubatividade,
    duplicateSubatividade,
    copiarSubatividades,
    deleteSubatividade,
    reorderAtividades,
    reorderSubatividades,
    createSubSubatividade,
    updateSubSubatividade,
    deleteSubSubatividade,
    reorderSubSubatividades,
    refresh,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
