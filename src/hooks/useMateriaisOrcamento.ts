import { useCallback, useEffect, useState } from 'react';
import type { ItemMaterialOrcamento } from '../types/domain';
import { itemMaterialOrcamentoRepository } from '../data/repositories/itemMaterialOrcamentoRepository';

export function useMateriaisOrcamento(obraId: string) {
  const [overrides, setOverrides] = useState<ItemMaterialOrcamento[]>([]);

  const refresh = useCallback(() => {
    setOverrides(itemMaterialOrcamentoRepository.list().filter((i) => i.obraId === obraId));
  }, [obraId]);
  useEffect(() => refresh(), [refresh]);

  const createOverride = useCallback(
    async (item: ItemMaterialOrcamento) => {
      itemMaterialOrcamentoRepository.create(item);
      refresh();
    },
    [refresh],
  );

  const updateOverride = useCallback(
    async (id: string, patch: Partial<ItemMaterialOrcamento>) => {
      itemMaterialOrcamentoRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteOverride = useCallback(
    async (id: string) => {
      itemMaterialOrcamentoRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { overrides, createOverride, updateOverride, deleteOverride, refresh };
}
