import { useCallback, useEffect, useState } from 'react';
import type { MaterialCatalogItem } from '../types/domain';
import { materialCatalogRepository } from '../data/repositories/materialCatalogRepository';

export function useMateriaisCatalogo() {
  const [materiais, setMateriais] = useState<MaterialCatalogItem[]>([]);

  const refresh = useCallback(() => setMateriais(materialCatalogRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createMaterial = useCallback(
    async (material: MaterialCatalogItem) => {
      materialCatalogRepository.create(material);
      refresh();
    },
    [refresh],
  );

  const updateMaterial = useCallback(
    async (id: string, patch: Partial<MaterialCatalogItem>) => {
      materialCatalogRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteMaterial = useCallback(
    async (id: string) => {
      materialCatalogRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { materiais, createMaterial, updateMaterial, deleteMaterial, refresh };
}
