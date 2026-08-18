import { useCallback, useEffect, useState } from 'react';
import type { ItemRequisicao } from '../types/domain';
import { requisicaoRepository } from '../data/repositories/requisicaoRepository';

export function useRequisicoes(obraId: string) {
  const [requisicoes, setRequisicoes] = useState<ItemRequisicao[]>([]);

  const refresh = useCallback(
    () => setRequisicoes(requisicaoRepository.list().filter((r) => r.obraId === obraId)),
    [obraId],
  );
  useEffect(() => refresh(), [refresh]);

  const createRequisicoes = useCallback(
    async (itens: ItemRequisicao[]) => {
      for (const item of itens) requisicaoRepository.create(item);
      refresh();
    },
    [refresh],
  );

  const updateRequisicao = useCallback(
    async (id: string, patch: Partial<ItemRequisicao>) => {
      requisicaoRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteRequisicao = useCallback(
    async (id: string) => {
      requisicaoRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { requisicoes, createRequisicoes, updateRequisicao, deleteRequisicao, refresh };
}
