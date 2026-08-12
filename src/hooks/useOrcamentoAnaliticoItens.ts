import { useCallback, useEffect, useState } from 'react';
import type { ItemOrcamentoAnalitico } from '../types/domain';
import { itemOrcamentoAnaliticoRepository } from '../data/repositories/itemOrcamentoAnaliticoRepository';

export function useOrcamentoAnaliticoItens(obraId: string) {
  const [itens, setItens] = useState<ItemOrcamentoAnalitico[]>([]);

  const refresh = useCallback(() => {
    setItens(itemOrcamentoAnaliticoRepository.list().filter((i) => i.obraId === obraId));
  }, [obraId]);
  useEffect(() => refresh(), [refresh]);

  const createItem = useCallback(
    async (item: ItemOrcamentoAnalitico) => {
      itemOrcamentoAnaliticoRepository.create(item);
      refresh();
    },
    [refresh],
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<ItemOrcamentoAnalitico>) => {
      itemOrcamentoAnaliticoRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      itemOrcamentoAnaliticoRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { itens, createItem, updateItem, deleteItem, refresh };
}
