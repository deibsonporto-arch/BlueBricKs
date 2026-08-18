import { useCallback, useEffect, useState } from 'react';
import type { Atividade, Subatividade } from '../types/domain';
import { atividadeRepository } from '../data/repositories/atividadeRepository';
import { deriveParentStatus, recomputeParentAggregates, resolveSubatividadeDates } from '../utils/subatividades';
import { resolveAtividadeDates } from '../utils/atividadeSchedule';

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

export function useAtividades(obraId: string) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  const refresh = useCallback(() => {
    // Roda a cada refresh (inclusive na montagem) para autocorrigir cronogramas antigos que ficaram
    // com datas desatualizadas de antes desta cadeia unificada existir — não só em edições novas.
    cascadeScheduleUpdates(obraId);
    setAtividades(atividadeRepository.list().filter((a) => a.obraId === obraId));
  }, [obraId]);
  useEffect(() => refresh(), [refresh]);

  const createAtividade = useCallback(
    async (atividade: Atividade) => {
      atividadeRepository.create(atividade);
      refresh();
    },
    [refresh],
  );

  const updateAtividade = useCallback(
    async (id: string, patch: Partial<Atividade>) => {
      atividadeRepository.update(id, patch);
      refresh();
    },
    [obraId, refresh],
  );

  const deleteAtividade = useCallback(
    async (id: string) => {
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

  const updateSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string, patch: Partial<Subatividade>) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === atividadeId);
      if (!atividade) return;

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

  const deleteSubatividade = useCallback(
    async (atividadeId: string, subatividadeId: string) => {
      const all = atividadeRepository.list().filter((a) => a.obraId === obraId);
      const atividade = all.find((a) => a.id === atividadeId);
      if (!atividade) return;

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

  const reorderAtividades = useCallback(
    async (idsNaNovaOrdem: string[]) => {
      atividadeRepository.reorderByObra(obraId, idsNaNovaOrdem);
      refresh();
    },
    [obraId, refresh],
  );

  const reorderSubatividades = useCallback(
    async (atividadeId: string, idsNaNovaOrdem: string[]) => {
      const atividade = atividadeRepository.get(atividadeId);
      if (!atividade) return;

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
    deleteSubatividade,
    reorderAtividades,
    reorderSubatividades,
    refresh,
  };
}
