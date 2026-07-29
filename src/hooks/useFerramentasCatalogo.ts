import { useCallback, useEffect, useState } from 'react';
import type { FerramentaCatalogItem } from '../types/domain';
import { ferramentaCatalogRepository } from '../data/repositories/ferramentaCatalogRepository';

export function useFerramentasCatalogo() {
  const [catalogo, setCatalogo] = useState<FerramentaCatalogItem[]>([]);

  const refresh = useCallback(() => setCatalogo(ferramentaCatalogRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createItem = useCallback(
    async (item: FerramentaCatalogItem) => {
      ferramentaCatalogRepository.create(item);
      refresh();
    },
    [refresh],
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<FerramentaCatalogItem>) => {
      ferramentaCatalogRepository.update(id, { ...patch, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      ferramentaCatalogRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { catalogo, createItem, updateItem, deleteItem, refresh };
}
