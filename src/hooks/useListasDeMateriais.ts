import { useCallback, useEffect, useState } from 'react';
import type { ListaDeMateriais } from '../types/domain';
import { listaDeMateriaisRepository } from '../data/repositories/listaDeMateriaisRepository';

export function useListasDeMateriais() {
  const [listas, setListas] = useState<ListaDeMateriais[]>([]);

  const refresh = useCallback(() => setListas(listaDeMateriaisRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createLista = useCallback(
    async (lista: ListaDeMateriais) => {
      listaDeMateriaisRepository.create(lista);
      refresh();
    },
    [refresh],
  );

  const updateLista = useCallback(
    async (id: string, patch: Partial<ListaDeMateriais>) => {
      listaDeMateriaisRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteLista = useCallback(
    async (id: string) => {
      listaDeMateriaisRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { listas, createLista, updateLista, deleteLista, refresh };
}
