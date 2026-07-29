import { useCallback, useEffect, useState } from 'react';
import type { LocalFerramentas } from '../types/domain';
import { localFerramentasRepository } from '../data/repositories/localFerramentasRepository';

export function useLocaisFerramentas() {
  const [locais, setLocais] = useState<LocalFerramentas[]>([]);

  const refresh = useCallback(() => setLocais(localFerramentasRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createLocal = useCallback(
    async (local: LocalFerramentas) => {
      localFerramentasRepository.create(local);
      refresh();
    },
    [refresh],
  );

  const updateLocal = useCallback(
    async (id: string, patch: Partial<LocalFerramentas>) => {
      localFerramentasRepository.update(id, { ...patch, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh],
  );

  const deleteLocal = useCallback(
    async (id: string) => {
      localFerramentasRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { locais, createLocal, updateLocal, deleteLocal, refresh };
}
