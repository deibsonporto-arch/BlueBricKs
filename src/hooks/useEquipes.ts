import { useCallback, useEffect, useState } from 'react';
import type { Equipe } from '../types/domain';
import { equipeRepository } from '../data/repositories/equipeRepository';

export function useEquipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);

  const refresh = useCallback(() => setEquipes(equipeRepository.list()), []);
  useEffect(() => refresh(), [refresh]);

  const createEquipe = useCallback(
    async (equipe: Equipe) => {
      equipeRepository.create(equipe);
      refresh();
    },
    [refresh],
  );

  const updateEquipe = useCallback(
    async (id: string, patch: Partial<Equipe>) => {
      equipeRepository.update(id, patch);
      refresh();
    },
    [refresh],
  );

  const deleteEquipe = useCallback(
    async (id: string) => {
      equipeRepository.remove(id);
      refresh();
    },
    [refresh],
  );

  return { equipes, createEquipe, updateEquipe, deleteEquipe, refresh };
}
