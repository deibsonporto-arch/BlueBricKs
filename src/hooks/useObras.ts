import { useCallback, useEffect, useState } from 'react';
import type { Obra } from '../types/domain';
import { obraRepository } from '../data/repositories/obraRepository';
import { atividadeRepository } from '../data/repositories/atividadeRepository';

export function useObras() {
  const [obras, setObras] = useState<Obra[]>([]);

  const refresh = useCallback(() => setObras(obraRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createObra = useCallback(
    async (obra: Obra) => {
      obraRepository.create(obra);
      refresh();
    },
    [refresh],
  );

  const updateObra = useCallback(
    async (id: string, patch: Partial<Obra>) => {
      obraRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteObra = useCallback(
    async (id: string) => {
      obraRepository.remove(id);
      atividadeRepository
        .list()
        .filter((a) => a.obraId === id)
        .forEach((a) => atividadeRepository.remove(a.id));
      refresh();
    },
    [refresh],
  );

  return { obras, createObra, updateObra, deleteObra, refresh };
}
